"""Sync the private corpus, seed mapping, and prior state from GCS before the server starts.

Runs once as a pre-start step in the container (see the Dockerfile CMD), so the seed-contracts
file exists on disk before ``fineprint.config`` is imported by uvicorn — and the OCR pickles +
ground-truth workbook + prior benchmark state are in place before the first request. No-op when
``FINEPRINT_BUCKET`` is unset (local dev).
"""
import os
from pathlib import Path

from fineprint import config, store, watch


def main() -> None:
    if not store.enabled():
        print("bootstrap: FINEPRINT_BUCKET unset — skipping GCS sync (local mode)")
        return

    seed = os.environ.get("FINEPRINT_SEED_CONTRACTS")
    if seed:
        store.download("corpus/seed_contracts.json", Path(seed))

    n = store.download_prefix("corpus/ocr", Path(config.OCR_DIR))
    store.download("corpus/ground_truth.xlsx", Path(config.GROUND_TRUTH))
    store.download_prefix("playground/samples", Path(config.SAMPLE_DIR))

    for obj, local in {
        "state/runs.json": config.RESULTS,
        "state/data.json": config.WEB_DATA,
        "state/roster.json": config.ROSTER_FILE,
        "state/seen_models.json": watch.SEEN_FILE,
    }.items():
        store.download(obj, Path(local))

    print(f"bootstrap: synced {n} OCR docs + ground truth + state from gs://{store.BUCKET}")


if __name__ == "__main__":
    main()
