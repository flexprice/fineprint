"""GCS-backed persistence for the FinePrint service.

Cloud Run instances are stateless and scale to zero, so the benchmark's mutable state — raw
``runs.json``, the anonymized ``data.json``, the ad-hoc ``roster.json``, and the watch-loop
``seen_models.json`` — plus the private corpus (OCR pickles + ground-truth workbook) live in a
GCS bucket. The service syncs state down at the start of each request and back up at the end, so
concurrent-safe as long as evals are serialized (Cloud Run concurrency=1, max-instances=1).

Set ``FINEPRINT_BUCKET`` to enable. With it unset every call is a no-op, so local dev is unaffected.
Auth uses Application Default Credentials (the Cloud Run service account) — no keys in the image.

Layout:  gs://<bucket>/corpus/ocr/*.pkl · corpus/ground_truth.xlsx · state/*.json · public/data.json
"""
import os
from pathlib import Path

BUCKET = os.environ.get("FINEPRINT_BUCKET", "").strip()

_client = None


def enabled() -> bool:
    return bool(BUCKET)


def _bucket():
    global _client
    if _client is None:
        from google.cloud import storage
        _client = storage.Client()
    return _client.bucket(BUCKET)


def download(obj: str, dest: Path) -> bool:
    """Download one object to dest. Returns False if it doesn't exist (fresh state is fine)."""
    if not enabled():
        return False
    blob = _bucket().blob(obj)
    if not blob.exists():
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    blob.download_to_filename(str(dest))
    return True


def download_prefix(prefix: str, dest_dir: Path) -> int:
    """Mirror every object under prefix/ into dest_dir. Returns the count downloaded."""
    if not enabled():
        return 0
    dest_dir.mkdir(parents=True, exist_ok=True)
    n = 0
    for blob in _client.list_blobs(BUCKET, prefix=prefix.rstrip("/") + "/"):
        rel = blob.name[len(prefix.rstrip("/")) + 1:]
        if not rel:
            continue
        out = dest_dir / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        blob.download_to_filename(str(out))
        n += 1
    return n


def upload(src: Path, obj: str, content_type: str | None = None) -> None:
    if not enabled() or not Path(src).exists():
        return
    blob = _bucket().blob(obj)
    blob.upload_from_filename(str(src), content_type=content_type)
