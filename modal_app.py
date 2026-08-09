"""FinePrint autopilot on Modal — the RECOMMENDED primary host.

Why Modal (vs GitHub Actions): the eval needs the PRIVATE contract corpus + ground-truth
workbook, which live nowhere public. Modal lets you keep that private data on a persistent
Volume (uploaded once), attach secrets cleanly, and run the poll on a cron — all serverless, pay
only for the seconds a poll actually runs. A zero-new poll is a few seconds of CPU.

The core logic is 100% in `fineprint/watch.py`; this file is a ~40-line scheduler wrapper, so the
exact same `python -m fineprint.watch` runs locally, on Modal, or on GitHub Actions.

One-time setup
--------------
1) pip install modal && modal token new
2) Create the secret bundle (names match fineprint/config.py + watch.py env):
     modal secret create fineprint-secrets \
       OPENROUTER_API_KEY=sk-or-... \
       OPENAI_API_KEY=sk-... \
       SLACK_WEBHOOK_URL=https://hooks.slack.com/services/... \
       VERCEL_DEPLOY_HOOK_URL=https://api.vercel.com/v1/integrations/deploy/prj_.../... \
       FINEPRINT_SITE_URL=https://fineprint.your-domain.com
3) Upload the PRIVATE corpus to the Volume (once, and whenever labels change):
     modal volume create fineprint-data
     modal volume put fineprint-data ./fineprint/data/ocr           /corpus/ocr
     modal volume put fineprint-data ./path/to/ground_truth.xlsx    /corpus/ground_truth.xlsx
4) Deploy the cron:      modal deploy modal_app.py
   Run once by hand:     modal run modal_app.py::run_now
   Dry run:              modal run modal_app.py::dry_run
"""
import modal

# The image carries only what the watcher needs; the repo is mounted so `fineprint`/`pipeline`
# import exactly as they do locally.
image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install_from_requirements("fineprint/requirements-watch.txt")
    .add_local_dir(".", remote_path="/root/app", ignore=["**/node_modules", "**/.next", "**/.git"])
)

# Persistent state: the private corpus (read-only after upload) AND the 'seen' set live here,
# so detection is stateful across polls and the labeled data never touches git or the image.
volume = modal.Volume.from_name("fineprint-data", create_if_missing=True)

app = modal.App("fineprint-watch")

# These env names are read by fineprint/config.py + watch.py — point the harness at the Volume so
# the private corpus and the mutable 'seen' set both live on persistent storage, never in git.
_ENV = {
    "FINEPRINT_OCR_DIR": "/data/corpus/ocr",
    "FINEPRINT_GROUND_TRUTH": "/data/corpus/ground_truth.xlsx",
    "FINEPRINT_SEEN_FILE": "/data/state/seen_models.json",
}


def _poll(dry_run: bool = False) -> None:
    import os
    import sys
    from pathlib import Path
    os.chdir("/root/app")
    sys.path.insert(0, "/root/app")
    os.environ.update(_ENV)
    Path("/data/state").mkdir(parents=True, exist_ok=True)
    import fineprint.watch as watch
    watch.poll(dry_run=dry_run)
    volume.commit()   # flush seen_models.json back to the Volume


# Every 6 hours. Generous timeout so a real multi-model batch can finish; a hung endpoint is
# already capped per-model inside watch.py, so this is just an outer safety net.
@app.function(image=image, volumes={"/data": volume},
              secrets=[modal.Secret.from_name("fineprint-secrets")],
              schedule=modal.Cron("0 */6 * * *"), timeout=60 * 90, cpu=2.0)
def scheduled_poll():
    _poll(dry_run=False)


@app.function(image=image, volumes={"/data": volume},
              secrets=[modal.Secret.from_name("fineprint-secrets")], timeout=60 * 90, cpu=2.0)
def run_now():
    _poll(dry_run=False)


@app.function(image=image, volumes={"/data": volume},
              secrets=[modal.Secret.from_name("fineprint-secrets")], timeout=60 * 10)
def dry_run():
    _poll(dry_run=True)
