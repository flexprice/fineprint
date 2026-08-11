# FinePrint service — the autonomous benchmark backend (Cloud Run).
# Build context is the repo root so pipeline/ + overrides/ + fineprint/ resolve like in dev.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app

COPY requirements-server.txt ./
RUN pip install --no-cache-dir -r requirements-server.txt

# The harness + its extraction schema/scorer + rules. The web app is excluded via .dockerignore.
COPY pipeline/ ./pipeline/
COPY overrides/ ./overrides/
COPY fineprint/ ./fineprint/

# Cloud Run sets $PORT; default 8080 for local `docker run`.
ENV PORT=8080
# Sync corpus/seed/state from GCS (no-op without FINEPRINT_BUCKET) BEFORE uvicorn imports config,
# so the private seed-contracts mapping is on disk first.
CMD python -m fineprint.bootstrap || true; exec uvicorn fineprint.server:app --host 0.0.0.0 --port ${PORT}
