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
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel

from fineprint import config, leads, notify, playground, store, watch
from fineprint.config import PLAYGROUND_MODELS, SAMPLE_DIR, SITE_ORIGINS, all_models
from fineprint.ratelimit import Limiter

app = FastAPI(title="FinePrint", docs_url="/docs", redoc_url=None)

app.add_middleware(CORSMiddleware, allow_origins=SITE_ORIGINS,
                   allow_methods=["GET", "POST", "OPTIONS"], allow_headers=["*"])


@app.exception_handler(Exception)
async def unhandled_exception(request: Request, exc: Exception) -> JSONResponse:
    """Answer a crash in the same shape as a handled error — and WITH the CORS header.

    Starlette's stack is ServerErrorMiddleware -> CORSMiddleware -> router, so an uncaught
    exception is turned into a 500 by the OUTERMOST middleware and never passes back through the
    CORS wrapper. The browser then blocks the response and ``fetch`` rejects with a bare
    "Failed to fetch": the real status is invisible to the client, and every backend crash looks
    identical from the outside. (An OpenRouter 402 for exhausted credits hid behind this for a
    day.) Setting the header here restores the status to the caller. The detail stays generic on
    purpose — this endpoint is public; the traceback goes to the logs, where it belongs, because
    ServerErrorMiddleware still re-raises after we answer.
    """
    origin = request.headers.get("origin", "")
    headers = {"access-control-allow-origin": origin, "vary": "Origin"} if origin in SITE_ORIGINS else {}
    return JSONResponse({"detail": "the benchmark service hit an internal error — please retry"},
                        status_code=500, headers=headers)
_limiter = Limiter(max_hits=int(os.environ.get("FINEPRINT_PLAYGROUND_RPM", "12")), window_s=60)
# The upload flow is the only public endpoint that spends money per call — live Datalab OCR plus a
# model call. The general per-minute limit is sized for the cheap sample path; at 12/min one IP
# could drive hundreds of paid runs an hour. Uploads get their own, far smaller hourly budget.
_upload_limiter = Limiter(max_hits=int(os.environ.get("FINEPRINT_UPLOADS_PER_HOUR", "3")), window_s=3600)

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


@app.get("/board")
def board(authorization: str | None = Header(None),
          x_fineprint_token: str | None = Header(None)) -> dict:
    """The published leaderboard, so the site build can fetch what the autopilot published.

    The site builds from a committed data.json, while the autopilot publishes into GCS — without
    this endpoint a cron publish reaches Slack but never the website. Serving it from here keeps
    the corpus bucket private and needs no GCP credentials in CI: the deploy workflow already holds
    FINEPRINT_URL and FINEPRINT_API_TOKEN. Content is per-model aggregates only, the same anonymized
    data the site already serves — no contract identities.
    """
    _auth(authorization, x_fineprint_token)
    _sync_down()
    p = Path(config.WEB_DATA)
    if not p.exists():
        raise HTTPException(404, "no published board yet")
    return json.loads(p.read_text())


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
    row = _row_for(model_id)
    announced = False
    if req.publish:
        _sync_up()
        watch._trigger_vercel(os.environ.get("VERCEL_DEPLOY_HOOK_URL", "").strip())
        # Announce the launch, same card the autopilot posts. Without this an on-demand eval lands
        # on the board silently, or — worse — the only Slack message about the model is a warning,
        # which reads as a failure even though the benchmark succeeded.
        slack = os.environ.get("SLACK_WEBHOOK_URL", "").strip()
        if slack and row:
            data = json.loads(Path(config.WEB_DATA).read_text()) if Path(config.WEB_DATA).exists() else {}
            text, blocks = notify.build_launch_blocks(
                row, os.environ.get("FINEPRINT_SITE_URL", "https://fineprint.flexprice.io"),
                data.get("n_models") or 0, data.get("baseline_label"), data.get("baseline_acc"))
            notify.post_slack(slack, text, blocks)
            announced = True
    return {"ok": True, "model": req.model, "runs": runs, "published": req.publish,
            "announced": announced, "row": row}


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


def _sample_catalog() -> list[dict]:
    """Sample metadata (id/title/type/source). On the deployed service this ships WITH the
    samples as SAMPLE_DIR/catalog.json (synced from GCS at boot) — the site's web/ dir is not
    in the container image, so we can't read it there. Locally it falls back to the site catalog."""
    for path in (SAMPLE_DIR / "catalog.json", config.HERE / "web" / "lib" / "playground-samples.json"):
        if path.exists():
            try:
                return json.loads(path.read_text())
            except (json.JSONDecodeError, OSError):
                continue
    return []


def _known_sample_ids() -> set[str]:
    """Allowlist of playground sample ids, sourced from the sample catalog."""
    return {s["id"] for s in _sample_catalog()}


def _load_sample_result(sample_id: str, model_id: str) -> dict:
    """Precomputed default extraction (instant) or live-run the model over cached sample OCR."""
    import pickle

    # sample_id comes straight from the request body — validate against an allowlist BEFORE
    # it ever touches a path or pickle.loads(), or a crafted id (e.g. "../secret") could read
    # arbitrary files / deserialize arbitrary pickles off disk.
    if not sample_id or not _SAMPLE_ID_RE.match(sample_id) or sample_id not in _known_sample_ids():
        raise HTTPException(404, f"unknown sample {sample_id!r}")
    base = SAMPLE_DIR / sample_id
    meta_path, doc_path, pages_path = base / "meta.json", base / "doc.pkl", base / "pages.json"
    if not meta_path.exists() or not doc_path.exists() or not pages_path.exists():
        # listed in the public sample catalog (playground-samples.json) but not (yet) prepped
        # on this deployment — a missing-data problem, not a client error.
        raise HTTPException(503, "sample not available")
    default_path = base / "result.json"
    if model_id == json.loads(meta_path.read_text())["default_model"] and default_path.exists():
        return json.loads(default_path.read_text())
    doc = pickle.loads(doc_path.read_bytes())
    pages = json.loads(pages_path.read_text())               # precomputed page images
    res = playground.extract_result(doc, _resolve_model(model_id))
    res["pages"] = pages
    return res


@app.get("/samples")
def list_samples(request: Request) -> dict:
    """The samples that are actually prepped on THIS deployment (their page renders exist). The
    site renders a chip only for these, so it never shows a dead/placeholder sample button. The
    catalog (title/type/source) comes from the site's playground-samples.json."""
    if not _limiter.allow(_client_id(request), time.time()):
        raise HTTPException(429, "rate limit — try again shortly")
    avail = [c for c in _sample_catalog() if (SAMPLE_DIR / c["id"] / "pages.json").exists()]
    return {"samples": avail}


@app.get("/sample/{sample_id}/pages")
def sample_pages(sample_id: str, request: Request) -> dict:
    """Rendered page images for a prepped sample — lets the site show the contract on the left
    the instant it's picked, before (and independent of) any model run. No OCR, no model, no
    gate: just the precomputed, public page renders. Same allowlist guard as /extract."""
    if not _limiter.allow(_client_id(request), time.time()):
        raise HTTPException(429, "rate limit — try again shortly")
    if not sample_id or not _SAMPLE_ID_RE.match(sample_id) or sample_id not in _known_sample_ids():
        raise HTTPException(404, f"unknown sample {sample_id!r}")
    pages_path = SAMPLE_DIR / sample_id / "pages.json"
    if not pages_path.exists():                       # in the catalog but not prepped on this deploy
        raise HTTPException(503, "sample not available")
    return {"pages": json.loads(pages_path.read_text())}


def _extract_upload(pdf: bytes, resolved_model: dict) -> dict:
    """Blocking upload pipeline (live Datalab OCR + model + page render). MUST run in a worker
    thread: the Datalab SDK calls asyncio.run() internally, which raises inside the async request
    handler's already-running event loop. The temp PDF is written and unlinked here so it never
    outlives the request (the upload is never persisted)."""
    import tempfile
    from pipeline.extractor import extract_document
    from pipeline.render import render_pages

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tf:
        tf.write(pdf)
        tmp = tf.name
    try:
        doc = extract_document(tmp, cache=False)         # live Datalab OCR — never cached to disk
        res = playground.extract_result(doc, resolved_model)
        res["pages"] = [{"image": "data:image/png;base64," + base64.b64encode(p["png"]).decode(),
                         "w": p["w"], "h": p["h"]} for p in render_pages(pdf)]
        return res
    finally:
        os.unlink(tmp)                                  # never persist the upload


@app.post("/lead")
async def lead(request: Request) -> dict:
    if not _limiter.allow(_client_id(request), time.time()):
        raise HTTPException(429, "rate limit — try again shortly")
    body = await request.json()
    try:
        tok = leads.record_lead(email=body.get("email"), name=body.get("name"),
                                context=body.get("context") or {})
    except ValueError as e:
        raise HTTPException(422, str(e) or "invalid lead")
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
        # off the event loop: a non-default model triggers a blocking provider call
        return await run_in_threadpool(_load_sample_result, sample_id, body.get("model", PLAYGROUND_MODELS[0]))
    # upload path — gated
    if not leads.valid_session_token(session_token or ""):
        raise HTTPException(401, "enter your work email to run your own contract")
    # Checked after the token gate (a rejected caller must not burn someone's quota) and before the
    # file is read or any OCR is billed.
    if not _upload_limiter.allow(_client_id(request), time.time()):
        raise HTTPException(429, "upload limit reached — try again in an hour")
    pdf = await file.read()
    if len(pdf) > 10 * 1024 * 1024:
        raise HTTPException(413, "PDF too large (max 10 MB)")
    resolved_model = _resolve_model(model or PLAYGROUND_MODELS[0])   # before any paid OCR spend
    return await run_in_threadpool(_extract_upload, pdf, resolved_model)
