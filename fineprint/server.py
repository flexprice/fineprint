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
import json
import os
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

from fineprint import config, store, watch

app = FastAPI(title="FinePrint", docs_url="/docs", redoc_url=None)

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
