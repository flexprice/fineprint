#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# FinePrint backend — one-shot deploy to Google Cloud (Cloud Run + Scheduler).
#
# Deploys the benchmark service (fineprint/server.py): hourly autopilot + an
# on-demand /watch + a /eval "give me an OpenRouter model and it does the job" hook.
# Idempotent — safe to re-run to ship a new revision.
#
# Prereqs (the account running this needs these roles on $PROJECT):
#   roles/serviceusage.serviceUsageAdmin, roles/storage.admin, roles/run.admin,
#   roles/artifactregistry.admin, roles/secretmanager.admin,
#   roles/cloudscheduler.admin, roles/iam.serviceAccountAdmin, roles/iam.serviceAccountUser
#
# Usage:
#   export OPENROUTER_API_KEY=sk-or-...        # required
#   export FINEPRINT_API_TOKEN=$(openssl rand -hex 24)   # required (protects /eval and /watch)
#   export CORPUS_OCR_DIR=/path/to/ocr         # dir of *.pkl (private, NOT in the repo)
#   export GROUND_TRUTH=/path/to/ground_truth.xlsx
#   export SEED_CONTRACTS_JSON=/path/to/seed_contracts.json   # [[display, folder], ...] real names
#   export INIT_RUNS_JSON=/path/to/runs.json   # optional: seed prior raw runs
#   export INIT_DATA_JSON=/path/to/data.json   # optional: seed the published board
#   # optional: SLACK_WEBHOOK_URL, VERCEL_DEPLOY_HOOK_URL, FINEPRINT_SITE_URL
#   ./deploy/deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT="${PROJECT:-flexprice-ai}"
REGION="${REGION:-us-central1}"
BUCKET="${BUCKET:-${PROJECT}-fineprint}"
SERVICE="${SERVICE:-fineprint}"
SA_NAME="${SA_NAME:-fineprint-run}"
SA_EMAIL="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"
N_RUNS="${FINEPRINT_N_RUNS:-3}"
here="$(cd "$(dirname "$0")/.." && pwd)"

: "${OPENROUTER_API_KEY:?set OPENROUTER_API_KEY}"
: "${FINEPRINT_API_TOKEN:?set FINEPRINT_API_TOKEN}"

echo "▸ project=$PROJECT region=$REGION bucket=gs://$BUCKET service=$SERVICE"

echo "▸ enabling APIs (non-fatal: most are already on; enable needs Cloud ToS acceptance)"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com cloudscheduler.googleapis.com storage.googleapis.com --project "$PROJECT" \
  || echo "  (enable skipped — proceeding with already-enabled APIs)"

echo "▸ bucket"
gcloud storage buckets create "gs://$BUCKET" --project "$PROJECT" --location "$REGION" \
  --uniform-bucket-level-access 2>/dev/null || echo "  (exists)"

echo "▸ runtime service account"
gcloud iam service-accounts create "$SA_NAME" --project "$PROJECT" \
  --display-name "FinePrint Cloud Run" 2>/dev/null || echo "  (exists)"
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member "serviceAccount:$SA_EMAIL" --role roles/storage.objectAdmin >/dev/null

echo "▸ uploading private corpus + state to gs://$BUCKET"
[ -n "${CORPUS_OCR_DIR:-}" ]      && gcloud storage cp "$CORPUS_OCR_DIR"/*.pkl "gs://$BUCKET/corpus/ocr/"
[ -n "${GROUND_TRUTH:-}" ]        && gcloud storage cp "$GROUND_TRUTH"        "gs://$BUCKET/corpus/ground_truth.xlsx"
[ -n "${SEED_CONTRACTS_JSON:-}" ] && gcloud storage cp "$SEED_CONTRACTS_JSON" "gs://$BUCKET/corpus/seed_contracts.json"
[ -n "${INIT_RUNS_JSON:-}" ]      && gcloud storage cp "$INIT_RUNS_JSON"      "gs://$BUCKET/state/runs.json"
[ -n "${INIT_DATA_JSON:-}" ]      && gcloud storage cp "$INIT_DATA_JSON"      "gs://$BUCKET/state/data.json"

echo "▸ secrets"
put_secret () {  # name value
  printf '%s' "$2" | gcloud secrets create "$1" --project "$PROJECT" --data-file=- 2>/dev/null \
    || printf '%s' "$2" | gcloud secrets versions add "$1" --project "$PROJECT" --data-file=-
  gcloud secrets add-iam-policy-binding "$1" --project "$PROJECT" \
    --member "serviceAccount:$SA_EMAIL" --role roles/secretmanager.secretAccessor >/dev/null
}
put_secret fineprint-openrouter-key "$OPENROUTER_API_KEY"
put_secret fineprint-api-token      "$FINEPRINT_API_TOKEN"
[ -n "${SLACK_WEBHOOK_URL:-}" ]     && put_secret fineprint-slack-webhook "$SLACK_WEBHOOK_URL"
[ -n "${VERCEL_DEPLOY_HOOK_URL:-}" ] && put_secret fineprint-vercel-hook  "$VERCEL_DEPLOY_HOOK_URL"

echo "▸ deploy Cloud Run (build from source via Cloud Build)"
ENVS="FINEPRINT_BUCKET=$BUCKET,FINEPRINT_N_RUNS=$N_RUNS"
ENVS="$ENVS,FINEPRINT_OCR_DIR=/tmp/fp/corpus/ocr,FINEPRINT_GROUND_TRUTH=/tmp/fp/corpus/ground_truth.xlsx"
ENVS="$ENVS,FINEPRINT_SEED_CONTRACTS=/tmp/fp/corpus/seed_contracts.json"
ENVS="$ENVS,FINEPRINT_RESULTS=/tmp/fp/state/runs.json,FINEPRINT_WEB_DATA=/tmp/fp/state/data.json"
ENVS="$ENVS,FINEPRINT_ROSTER=/tmp/fp/state/roster.json,FINEPRINT_SEEN_FILE=/tmp/fp/state/seen_models.json"
[ -n "${FINEPRINT_SITE_URL:-}" ] && ENVS="$ENVS,FINEPRINT_SITE_URL=$FINEPRINT_SITE_URL"

SECRETS="OPENROUTER_API_KEY=fineprint-openrouter-key:latest,FINEPRINT_API_TOKEN=fineprint-api-token:latest"
[ -n "${SLACK_WEBHOOK_URL:-}" ]     && SECRETS="$SECRETS,SLACK_WEBHOOK_URL=fineprint-slack-webhook:latest"
[ -n "${VERCEL_DEPLOY_HOOK_URL:-}" ] && SECRETS="$SECRETS,VERCEL_DEPLOY_HOOK_URL=fineprint-vercel-hook:latest"

gcloud run deploy "$SERVICE" --source "$here" --project "$PROJECT" --region "$REGION" \
  --service-account "$SA_EMAIL" \
  --cpu 2 --memory 2Gi --timeout 3600 --concurrency 1 --max-instances 1 --min-instances 0 \
  --allow-unauthenticated \
  --set-env-vars "$ENVS" --set-secrets "$SECRETS"

URL="$(gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='value(status.url)')"
echo "▸ service URL: $URL"

echo "▸ hourly Cloud Scheduler → POST $URL/watch"
{ gcloud scheduler jobs create http fineprint-watch --project "$PROJECT" --location "$REGION" \
    --schedule "0 * * * *" --uri "$URL/watch" --http-method POST \
    --headers "X-FinePrint-Token=$FINEPRINT_API_TOKEN" \
    --attempt-deadline 1800s --max-retry-attempts 0 2>/dev/null \
  || gcloud scheduler jobs update http fineprint-watch --project "$PROJECT" --location "$REGION" \
       --schedule "0 * * * *" --uri "$URL/watch" --http-method POST \
       --headers "X-FinePrint-Token=$FINEPRINT_API_TOKEN" --attempt-deadline 1800s ; } \
  || echo "  ⚠ scheduler NOT set (enable cloudscheduler.googleapis.com after accepting Cloud ToS, then re-run) — service + endpoints are live regardless"

echo "▸ seed the watch 'seen' set so the FIRST poll doesn't re-benchmark the whole catalog"
curl -s -X POST "$URL/watch?dry_run=true" -H "X-FinePrint-Token: $FINEPRINT_API_TOKEN" | head -c 400 || true; echo

cat <<EOF

✅ Deployed. Endpoints (send the token on the two POSTs):
   GET  $URL/healthz
   POST $URL/eval   -H "X-FinePrint-Token: $TOKEN" -d '{"model":"anthropic/claude-opus-5","runs":3}'
   POST $URL/watch  -H "X-FinePrint-Token: $TOKEN"     # on-demand sweep (Scheduler runs it hourly)
EOF
