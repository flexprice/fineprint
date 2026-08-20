"""FinePrint service — the autonomous benchmark backend, as a small HTTP API.

Endpoints (all evals run against the private corpus, serialized — Cloud Run concurrency=1):

  GET  /healthz                      liveness + how many models are on the board
  POST /eval    {"model": "...",     benchmark ONE model by its OpenRouter id (or curated id),
                 "runs": 3,           publish it, and return its metric row. This is the
                 "publish": true}      "give me a model endpoint and it does the job" hook.
  POST /watch   {"dry_run": false}    one autopilot poll: detect new models on OpenRouter,
                                       benchmark + publish + Slack-announce them. Cloud Scheduler
                                       hits this hourly; call it yourself for an on-demand sweep.

Auth: send the shared token as ``Authorization: Bearer <token>`` or ``X-FinePrint-Token: <token>``
(compared to env ``FINEPRINT_API_TOKEN``). ``/healthz`` is open. State (runs/roster/seen/data) and
the private corpus live in GCS (see ``store.py``); they are synced down per request and back up after.
"""
import base64
import json
import os
import re
import time
from pathlib import Path

from fastapi import FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from fineprint import config, leads, playground, store, watch
from fineprint.config import PLAYGROUND_MODELS, SAMPLE_DIR, SITE_ORIGINS, all_models
from fineprint.ratelimit import Limiter

app = FastAPI(title="FinePrint", docs_url="/docs", redoc_url=None)

app.add_middleware(CORSMiddleware, allow_origins=SITE_ORIGINS,
                   allow_methods=["POST", "OPTIONS"], allow_headers=["*"])
_limiter = Limiter(max_hits=int(os.environ.get("FINEPRINT_PLAYGROUND_RPM", "12")), window_s=60)

_TOKEN = os.environ.get("FINEPRINT_API_TOKEN", "").strip()
# GCS object names for each piece of mutable state (local paths come from config/watch, env-driven).
_STATE = {
    "state/runs.json": config.RESULTS,
    "state/data.json": config.WEB_DATA,
    "state/roster.json": config.ROSTER_FILE,
    "state/seen_models.json": watch.SEEN_FILE,
}


def _auth(authorization: str | None, x_token: str | None) -> None:
    if not _TOKEN:                       # no token configured → open (local/dev)
        return
    supplied = x_token or (authorization or "").removeprefix("Bearer ").strip()
    if supplied != _TOKEN:
        raise HTTPException(status_code=401, detail="bad or missing FinePrint token")


def _sync_down() -> None:
    for obj, local in _STATE.items():
        store.download(obj, Path(local))


def _sync_up() -> None:
    for obj, local in _STATE.items():
        store.upload(Path(local), obj)
    store.upload(Path(config.WEB_DATA), "public/data.json", content_type="application/json")


def _row_for(model_id: str) -> dict | None:
    if not Path(config.WEB_DATA).exists():
        return None
    data = json.loads(Path(config.WEB_DATA).read_text())
    return next((r for r in data.get("rows", []) if r.get("id") == model_id), None)


class EvalReq(BaseModel):
    model: str                 # OpenRouter id ("anthropic/claude-opus-5") or curated id
    runs: int | None = None
    publish: bool = True


@app.get("/")            # /healthz is intercepted by Google's front-end on Cloud Run, so alias it.
@app.get("/status")
@app.get("/healthz")
def healthz() -> dict:
    n = None
    if Path(config.WEB_DATA).exists():
        n = json.loads(Path(config.WEB_DATA).read_text()).get("n_models")
    return {"ok": True, "catalog_models": len(config.all_models()), "published_models": n,
            "bucket": store.BUCKET or None}


@app.post("/eval")
def eval_model(req: EvalReq, authorization: str | None = Header(None),
               x_fineprint_token: str | None = Header(None)) -> dict:
    _auth(authorization, x_fineprint_token)
    from fineprint.eval import evaluate
    _sync_down()
    runs = req.runs or int(os.environ.get("FINEPRINT_N_RUNS") or config.N_RUNS)
    model_id = req.model.split("/", 1)[1] if "/" in req.model else req.model
    try:
        evaluate(req.model, runs=runs, publish=req.publish)
    except SystemExit as e:                      # evaluate() exits on unknown model / total failure
        raise HTTPException(status_code=422, detail=f"eval failed for {req.model}: {e}")
    except Exception as e:                        # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")
    if req.publish:
        _sync_up()
        watch._trigger_vercel(os.environ.get("VERCEL_DEPLOY_HOOK_URL", "").strip())
    row = _row_for(model_id)
    return {"ok": True, "model": req.model, "runs": runs, "published": req.publish, "row": row}


@app.post("/watch")
def watch_poll(authorization: str | None = Header(None),
               x_fineprint_token: str | None = Header(None), dry_run: bool = False) -> dict:
    _auth(authorization, x_fineprint_token)
    _sync_down()
    published = watch.poll(dry_run=dry_run)
    if not dry_run:
        _sync_up()
    return {"ok": True, "dry_run": dry_run, "published": published}


# ── playground: /lead + /extract ───────────────────────────────────────────
def _client_id(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        # Rightmost entry is appended by our trusted last hop (proxy/load balancer); every
        # entry to its left is client-supplied and can be spoofed to mint a fresh XFF (and
        # thus a fresh rate-limit bucket) on every request, defeating the cap.
        return xff.split(",")[-1].strip()
    return request.client.host if request.client else "anon"


def _resolve_model(model_id: str) -> dict:
    m = next((x for x in all_models() if x["id"] == model_id), None)
    if not m:
        raise HTTPException(400, f"unknown model {model_id}")
    return m


_SAMPLE_ID_RE = re.compile(r"^[a-z0-9_-]+$")


def _known_sample_ids() -> set[str]:
    """Allowlist of playground sample ids, sourced from the site's published sample catalog."""
    path = config.HERE / "web" / "lib" / "playground-samples.json"
    if not path.exists():
        return set()
    return {s["id"] for s in json.loads(path.read_text())}


def _load_sample_result(sample_id: str, model_id: str) -> dict:
    """Precomputed default extraction (instant) or live-run the model over cached sample OCR."""
    import pickle

    # sample_id comes straight from the request body — validate against an allowlist BEFORE
    # it ever touches a path or pickle.loads(), or a crafted id (e.g. "../secret") could read
    # arbitrary files / deserialize arbitrary pickles off disk.
    if not sample_id or not _SAMPLE_ID_RE.match(sample_id) or sample_id not in _known_sample_ids():
        raise HTTPException(404, f"unknown sample {sample_id!r}")
    base = SAMPLE_DIR / sample_id
    default_path = base / "result.json"
    if model_id == json.loads((base / "meta.json").read_text())["default_model"] and default_path.exists():
        return json.loads(default_path.read_text())
    doc = pickle.loads((base / "doc.pkl").read_bytes())
    pages = json.loads((base / "pages.json").read_text())   # precomputed page images
    res = playground.extract_result(doc, _resolve_model(model_id))
    res["pages"] = pages
    return res


@app.post("/lead")
async def lead(request: Request) -> dict:
    body = await request.json()
    try:
        tok = leads.record_lead(email=body.get("email"), company=body.get("company"),
                                context=body.get("context") or {})
    except ValueError:
        raise HTTPException(422, "invalid email")
    return {"session_token": tok}


@app.post("/extract")
async def extract(request: Request, file: UploadFile = File(None),
                  model: str = Form(None), session_token: str = Form(None)) -> dict:
    if not _limiter.allow(_client_id(request), time.time()):
        raise HTTPException(429, "rate limit — try again shortly")
    if file is None:                                   # JSON sample path
        try:
            body = await request.json()
        except (json.JSONDecodeError, ValueError):
            raise HTTPException(422, "invalid JSON body")
        sample_id = body.get("sample_id")
        if not sample_id:
            raise HTTPException(422, "sample_id is required")
        return _load_sample_result(sample_id, body.get("model", PLAYGROUND_MODELS[0]))
    # upload path — gated
    if not leads.valid_session_token(session_token or ""):
        raise HTTPException(401, "enter your work email to run your own contract")
    pdf = await file.read()
    if len(pdf) > 10 * 1024 * 1024:
        raise HTTPException(413, "PDF too large (max 10 MB)")
    resolved_model = _resolve_model(model or PLAYGROUND_MODELS[0])   # before any paid OCR spend
    from pipeline.extractor import extract_document
    from pipeline.render import render_pages

    import tempfile

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tf:
        tf.write(pdf)
        tmp = tf.name
    try:
        doc = extract_document(tmp)                     # live Datalab OCR
        res = playground.extract_result(doc, resolved_model)
        res["pages"] = [{"image": "data:image/png;base64," + base64.b64encode(p["png"]).decode(),
                         "w": p["w"], "h": p["h"]} for p in render_pages(pdf)]
        return res
    finally:
        os.unlink(tmp)                                  # never persist the upload
