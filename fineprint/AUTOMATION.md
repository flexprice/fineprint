# FinePrint autopilot — detect → benchmark → publish → announce

An unattended loop that watches OpenRouter for newly-shipped models, benchmarks each one on the
private FinePrint contract set, republishes the leaderboard, and posts a Slack announcement.

It is a thin wrapper around the primitive that already exists:

```
python -m fineprint.eval <openrouter/id>     # run → score → aggregate → re-price → rewrite web/lib/data.json
```

The automation adds **detection** (what's new?), **orchestration** (eval each, safely), and
**delivery** (Slack + site redeploy). Everything routes through one portable entrypoint:

```
python -m fineprint.watch          # one poll
python -m fineprint.watch --dry-run   # list new models, evaluate nothing
python -m fineprint.watch --init      # seed the 'seen' set to the current catalog, no evals
```

## Architecture

```
        ┌────────── scheduler (Modal cron / GH Actions / crontab) ──────────┐
        │                                                                   │
        │   python -m fineprint.watch                                       │
        │     1. GET openrouter.ai/api/v1/models   (public, no key)         │
        │     2. diff vs data/seen_models.json  → genuinely-new chat models │
        │     3. for each new (capped, per-model wall-clock timeout):       │
        │           fineprint.eval.evaluate(orid, runs=N, publish=True)     │
        │              → runs → scores → merges results/runs.json           │
        │              → re-prices → rewrites web/lib/data.json             │
        │     4. Slack Block Kit announce each result   (notify.py)         │
        │     5. POST Vercel deploy hook → site goes live                   │
        │     6. persist updated seen_models.json                           │
        └───────────────────────────────────────────────────────────────────┘
```

Files added:

| File | Role |
|------|------|
| `fineprint/watch.py` | portable entrypoint: detect → eval → publish → announce; all state/config via env |
| `fineprint/notify.py` | Slack Block Kit builder + `urllib` POST (no SDK, no deps) |
| `fineprint/requirements-watch.txt` | minimal runtime deps for the watcher |
| `modal_app.py` | **recommended** primary host: cron + secrets + a Volume for the private corpus |
| `.github/workflows/fineprint-watch.yml` | portable alternative scheduler (cron wrapper) |
| `fineprint/data/seen_models.json` | runtime state (gitignored) — the detection high-water/seen set |

Nothing here duplicates the harness — detection and delivery are the only new logic; run/score/
export/pricing are all reused from the existing modules.

## New-model detection (the diff)

OpenRouter's `/api/v1/models` returns every model with a `created` Unix timestamp and an
`architecture` block (`input_modalities` / `output_modalities`). We persist a **seen set** of
OpenRouter ids plus a `created` high-water mark and, each poll, treat any eligible id not in the
set as new. "Eligible" applies lean noise filters:

- **skip variant suffixes** — anything with `:` (`:free`, `:nitro`, `:thinking`, `:online`, …); we
  benchmark the canonical base id only, so this also dedupes.
- **text-in → text-out chat only** — require `text` in both modality lists; drop image/audio
  generation, embeddings, moderation, rerank, tts/whisper, ocr, guard models.
- **skip `preview` / `-beta`.**
- **optional provider allowlist** — `FINEPRINT_WATCH_PROVIDERS` (e.g. `openai,anthropic,google`).
- **age guard** — ignore models whose `created` is older than `FINEPRINT_WATCH_MAX_AGE` days
  (default 45); these are recorded as seen so late catalog additions of old models don't trigger a run.

**Bootstrap:** the very first run (no `seen_models.json`) records the entire current catalog as seen
and evaluates **nothing** — otherwise every existing model would look "new". New models are picked
up from that point forward. (`--init` re-seeds deliberately.)

Existing OSS for watching model catalogs is essentially nil (there are OpenRouter *scrapers* like
Apify's, but no drop-in "new model" watcher), so the ~40-line differ here is the lean answer.

## Failure handling — a broken/slow model must not wedge the loop

Each model's eval runs in a **child process with a per-model wall-clock cap**
(`FINEPRINT_WATCH_TIMEOUT`, default 1800s). If a new endpoint hangs (the "3-hour-latency" case),
the process is terminated and the model is **skipped** with a soft Slack warning; the loop moves on.
`fineprint.eval.evaluate` calls `sys.exit` when every provider call fails — because it runs in a
child, that becomes a nonzero exit the parent treats as a skip, never a crash of the watcher.

By default a failed/timed-out model is **marked seen** so a persistently-broken endpoint is not
re-hammered every poll. Set `FINEPRINT_WATCH_RETRY_FAILED=1` to instead leave it unseen and retry
next poll (good for transient rate-limit blips). A poll is also capped at `FINEPRINT_WATCH_MAX_NEW`
models (default 4) so a big catalog drop can't launch dozens of evals at once — the remainder are
handled on subsequent polls.

## Cost & rate limits

Each new model ≈ **6 contracts × N runs** OpenRouter calls (default N=5 → 30 calls). Order-of-
magnitude cost per model is single-digit dollars for mid-tier models, driven by the model's own
`$/1M` pricing (the leaderboard's `cost_1k` is the measured figure). Key properties:

- **A poll with zero new models is ~free** — a single public catalog GET, no key, no eval.
- Poll cadence of every 6h is plenty (labs don't ship hourly) and keeps idle cost at zero.
- The per-poll cap bounds worst-case spend on a busy day.

## Secrets / env (never committed)

Set these on the host (Modal secret, GH Actions secrets, or shell env). `OPENROUTER_API_KEY` is
already in the repo `.env` for local runs.

| Var | Required | Purpose |
|-----|----------|---------|
| `OPENROUTER_API_KEY` | ✅ | provider calls (all models route through OpenRouter) |
| `OPENAI_API_KEY` | if used | direct-OpenAI routing path in `providers.py` |
| `SLACK_WEBHOOK_URL` | optional | Slack incoming webhook for announcements |
| `VERCEL_DEPLOY_HOOK_URL` | optional | redeploy the leaderboard after a new result |
| `FINEPRINT_SITE_URL` | optional | base URL used in Slack links (`/models/<id>`) |
| `FINEPRINT_WATCH_PROVIDERS` | optional | provider-prefix allowlist |
| `FINEPRINT_N_RUNS` | optional | runs/contract (default 5) |
| `FINEPRINT_WATCH_MAX_NEW` | optional | models/poll cap (default 4) |
| `FINEPRINT_WATCH_TIMEOUT` | optional | per-model wall-clock seconds (default 1800) |
| `FINEPRINT_WATCH_MAX_AGE` | optional | ignore models older than N days (default 45) |
| `FINEPRINT_SEEN_FILE` | optional | path to the seen-set (default `fineprint/data/seen_models.json`) |

> **Private data:** the eval needs the **private** contract corpus (`fineprint/data/ocr/*.pkl`) and
> ground-truth workbook (`FINEPRINT_GROUND_TRUTH`). These are gitignored and must be provisioned on
> whatever host runs the poll. This is the main reason Modal is the recommended host.

## Website publishing

`evaluate(..., publish=True)` already rewrites `web/lib/data.json` and creates the model's static
page (`web/app/(site)/models/[id]/page.tsx` builds from that data). To make the **live** site
reflect it, the watcher POSTs a **Vercel Deploy Hook** — a secret URL that triggers a redeploy with
no auth/payload (`curl -X POST <hook>`). This is cleaner than a git commit+push for a headless job.
Create one in Vercel: Project → Settings → Git → Deploy Hooks. If `VERCEL_DEPLOY_HOOK_URL` is unset,
data is updated locally but the site isn't redeployed.

## Slack message

`notify.py` builds a Block Kit card (header + section with fields + a "View on leaderboard" button +
context) and POSTs `{"text": <fallback>, "blocks": [...]}` to the webhook via `urllib`. Fields:
rank, accuracy (+delta vs baseline), $/1k, value, latency p50/p90, hallucination. Failures post a
compact `:warning:` message instead.

## Playground endpoints (`/extract`, `/lead`)

Public, CORS-restricted endpoints that power the `/try` playground. No `X-FinePrint-Token` (unlike `/eval`/`/watch`).

### `POST /extract`
Rate-limited to 12 requests/minute per client. Two request modes:

**Sample mode** — JSON body, no auth:
```
{ "sample_id": "guidewire", "model": "gpt-5.5" }
```
`sample_id` must be a known curated public sample (unknown → 404).

**Upload mode** — multipart form; requires a `session_token` from `/lead`:
- `file` — PDF, ≤ 10 MB (larger → 413)
- `model` — form field, a board model id (unknown → 400)
- `session_token` — form field, from `/lead` (missing/invalid → 401)

The uploaded PDF is OCR'd live (Chandra/Datalab); the temp file is deleted after the response — never stored.

**Response** (both modes):
```json
{
  "pages":  [ { "image": "data:image/png;base64,…", "w": 1280, "h": 823 } ],
  "fields": [ { "field": "recurring_fee.amount", "value": "$45,000",
                "confidence": "HIGH", "category": "Recurring Fee",
                "boxes": [ { "page": 0, "box": [0.19, 0.45, 0.24, 0.47] } ] } ],
  "model": "GPT-5.5", "latency": 41.2
}
```

`confidence` ∈ `HIGH | NEEDS_REVIEW | MISSING`; `box` is `[x0,y0,x1,y1]` normalized 0–1 on the given `page`.

Errors: 400 (unknown model) · 401 (bad/missing session_token on upload) · 404 (unknown sample_id) · 413 (PDF > 10 MB) · 422 (missing/invalid body) · 429 (rate limit).

### `POST /lead`
JSON body:
```json
{ "email": "you@company.com", "company": "Acme Inc.", "context": { "kind": "upload", "model": "gpt-5.5" } }
```

Validates the email (invalid → 422), posts a Slack notification, and appends the lead (email/company/model/sample-type only — never file contents) to a stored list. Returns:
```json
{ "session_token": "…" }
```

Pass this token as the `session_token` form field on `/extract`'s upload mode.

**Guards / privacy:** `/extract` is rate-limited (12 rpm/client) with a 10 MB PDF cap; the upload path is gated behind `/lead` (email capture). Uploaded files are processed transiently and not retained.

## Hosting — recommended primary: Modal

Modal is the recommended host because it cleanly carries all three things the eval needs — the
**private corpus** (on a persistent Volume, uploaded once), **secrets**, and a **cron** — while
staying serverless (you pay only for the seconds a poll runs; a zero-new poll is a few seconds).

```
pip install modal && modal token new
modal secret create fineprint-secrets OPENROUTER_API_KEY=... SLACK_WEBHOOK_URL=... \
    VERCEL_DEPLOY_HOOK_URL=... FINEPRINT_SITE_URL=...
modal volume create fineprint-data
modal volume put fineprint-data ./fineprint/data/ocr        /corpus/ocr
modal volume put fineprint-data ./path/to/ground_truth.xlsx /corpus/ground_truth.xlsx
modal deploy modal_app.py          # cron goes live (every 6h)
modal run   modal_app.py::run_now  # trigger a poll immediately
```

### Portability (the entrypoint is identical everywhere)

- **GitHub Actions** — `.github/workflows/fineprint-watch.yml` (cron + `workflow_dispatch`). Free,
  secrets built in, `actions/cache` persists the seen set. Caveat: you must fetch the private corpus
  in a step (S3/GCS sync) since it's not in git — a stub step is included.
- **Railway / Render / Fly** — add a cron/scheduled job running `python -m fineprint.watch`; mount
  the corpus on a persistent disk; set the same env vars.
- **Plain VM crontab** — `0 */6 * * * cd /repo && /repo/.venv/bin/python -m fineprint.watch`.

Because the core is one env-configured Python module, the scheduler is genuinely a thin wrapper —
swapping hosts is a config change, not a rewrite.

## Auto-publish vs. human gate

The pipeline as written **auto-publishes and auto-announces**. If you'd rather keep a human in the
loop for the first announcement of each model, run the scheduler with `SLACK_WEBHOOK_URL` pointed at
a private review channel (or unset `VERCEL_DEPLOY_HOOK_URL` so data updates but the site doesn't go
live until someone triggers a deploy). Flipping to fully-automatic is then just adding the public
webhook + deploy-hook secrets.
