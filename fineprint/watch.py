"""FinePrint autopilot — detect new models on OpenRouter, benchmark, publish, announce.

One portable entrypoint, run on any scheduler (GitHub Actions cron, Modal, Railway/Render cron,
a plain crontab):

    python -m fineprint.watch                 # one poll: detect -> eval -> publish -> Slack
    python -m fineprint.watch --dry-run       # list what WOULD be evaluated, do nothing
    python -m fineprint.watch --init          # (re)seed the 'seen' set to now, no evals

What it does each poll:
  1. Fetch the public OpenRouter catalog (``/api/v1/models``); diff against a persisted 'seen' set
     (``fineprint/data/seen_models.json``, gitignored) to find genuinely-new chat models.
  2. For each new model (up to a per-poll cap), run the EXISTING single-command eval
     ``fineprint.eval.evaluate(orid, runs=N, publish=True)`` in a child process with a wall-clock
     cap — so a broken / 3-hour-latency endpoint is skipped, never wedges the loop.
  3. If any succeeded: Slack-announce each (Block Kit) and POST the Vercel deploy hook to publish
     the refreshed site. Failures send a soft Slack warning.
  4. Persist the updated 'seen' set. Idempotent: a poll with zero new models does no eval and is
     essentially free (one catalog GET).

Config (all via env; secrets never committed):
  SLACK_WEBHOOK_URL          Slack incoming webhook (optional; skipped if unset)
  VERCEL_DEPLOY_HOOK_URL     Vercel deploy hook to redeploy the site (optional)
  FINEPRINT_WATCH_PROVIDERS  comma allowlist of provider prefixes, e.g. "openai,anthropic,google"
                             (optional; empty = all labs eligible)
  FINEPRINT_N_RUNS           runs per contract for the auto-eval (default: config.N_RUNS)
  FINEPRINT_WATCH_MAX_NEW    max models to benchmark per poll (default 4 — bounds cost)
  FINEPRINT_WATCH_TIMEOUT    per-model wall-clock cap, seconds (default 1800 = 30 min)
  FINEPRINT_WATCH_MAX_AGE    ignore models whose 'created' is older than N days (default 45)
  FINEPRINT_SITE_URL         leaderboard base URL for Slack links (default from NEXT_PUBLIC_SITE_URL)
  FINEPRINT_WATCH_RETRY_FAILED  "1" to leave failed models unseen (retry next poll); default: mark
                                seen so a broken endpoint is not re-hammered every poll.
"""
import argparse
import json
import multiprocessing as mp
import os
import time
import urllib.request
from pathlib import Path

from fineprint.config import HERE, N_RUNS, WEB_DATA
from fineprint import notify

CATALOG_URL = "https://openrouter.ai/api/v1/models"
# Override with FINEPRINT_SEEN_FILE to keep state on a persistent volume (e.g. Modal /data).
SEEN_FILE = Path(os.environ.get("FINEPRINT_SEEN_FILE", str(HERE / "data" / "seen_models.json")))

# ── noise filters ────────────────────────────────────────────────────────────
# Substrings that mark non-text / non-chat / preview endpoints we never benchmark.
_SKIP_SUBSTR = (
    "whisper", "tts", "embed", "moderation", "rerank", "-image", "image-", "dall-e",
    "sora", "-video", "video-", "-audio", "audio-", "vision-only", "guard", "ocr",
    # Purpose-built machine-translation models. They are chat-shaped, so the catalog filter lets
    # them through, but they are not document-extraction models and score near zero for reasons
    # that say nothing useful — Hy-MT2-7B read 1.2% of fields with 100% hallucination. Publishing
    # them is noise on the board and wastes a benchmark run per release.
    "-mt2", "mt2-", "-mt-", "translate", "translation", "opus-mt", "nllb", "madlad",
)

# Models excluded by exact OpenRouter id, for cases a substring can't express safely.
# Set FINEPRINT_EXCLUDE_MODELS to a comma-separated list to add more without a deploy.
_EXCLUDE_IDS = {"tencent/hy-mt2-1.8b", "tencent/hy-mt2-7b", "tencent/hy-mt2-30b-a3b"}


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def _fetch_catalog() -> list[dict]:
    with urllib.request.urlopen(CATALOG_URL, timeout=40) as r:
        return json.load(r)["data"]


def _is_chat_text_model(m: dict) -> bool:
    """True only for text-in -> text-out chat models (skip image/audio/embed/etc.)."""
    arch = m.get("architecture") or {}
    in_mods = arch.get("input_modalities") or []
    out_mods = arch.get("output_modalities") or []
    if in_mods or out_mods:
        if "text" not in in_mods or "text" not in out_mods:
            return False
        if "image" in out_mods or "audio" in out_mods:  # generation models
            return False
        return True
    # Fallback to the legacy 'modality' string like "text->text" / "text+image->text".
    modality = (arch.get("modality") or "").lower()
    return modality.endswith("text") if modality else True


def _eligible(m: dict, providers: set[str]) -> bool:
    orid = m.get("id", "")
    if not orid or "/" not in orid:
        return False
    if ":" in orid:                       # variant (:free, :nitro, :thinking, :online, …)
        return False
    low = orid.lower()
    if any(s in low for s in _SKIP_SUBSTR):
        return False
    if low in _EXCLUDE_IDS or low in {x.strip().lower() for x in _env("FINEPRINT_EXCLUDE_MODELS").split(",") if x.strip()}:
        return False
    if "preview" in low or "-beta" in low:
        return False
    if not _is_chat_text_model(m):
        return False
    if providers and orid.split("/", 1)[0] not in providers:
        return False
    return True


def _load_seen() -> dict:
    if SEEN_FILE.exists():
        return json.loads(SEEN_FILE.read_text())
    return {}


def _save_seen(seen_ids: set[str], high_water: int) -> None:
    SEEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    SEEN_FILE.write_text(json.dumps(
        {"high_water": high_water, "seen": sorted(seen_ids)}, indent=1))


# Safety gate: the autopilot may only publish to the public board while the board and the corpus
# actually agree. If the site's data.json was built from a different contract set than the one this
# service scores against, an auto-published new model lands beside numbers computed on other
# documents — models get compared across corpora, which is exactly how a flagship model once
# surfaced as rank #43. Set FINEPRINT_WATCH_PUBLISH=0 to keep detecting, benchmarking and
# Slack-announcing while withholding the board write until the two are reconciled.
def _publish_enabled() -> bool:
    return (_env("FINEPRINT_WATCH_PUBLISH") or "1") not in ("0", "false", "no")


# ── the eval, isolated so a wall-clock cap can terminate a hung endpoint ──────
def _eval_worker(orid: str, runs: int, publish: bool = True) -> None:
    """Child-process target: the existing single-command eval. Exits nonzero on total failure."""
    from fineprint.eval import evaluate           # imported here so spawn re-import is clean
    evaluate(orid, runs=runs, publish=publish)     # runs -> scores -> merges -> (maybe) republishes


# Exit codes raised by fineprint.eval — kept in sync so the Slack skip-reason is honest instead of
# always blaming the provider calls.
from fineprint.eval import EXIT_UNRESOLVABLE, EXIT_ALL_FAILED, EXIT_POLICY_BLOCKED

_EXIT_REASON = {
    EXIT_UNRESOLVABLE: "not on OpenRouter anymore (withdrawn / renamed stealth or preview variant)",
    EXIT_ALL_FAILED: "resolved, but every provider call errored (see eval logs)",
    EXIT_POLICY_BLOCKED: "blocked by this OpenRouter account's privacy/data-policy settings — no "
                          "provider for this model meets the configured guardrails "
                          "(openrouter.ai/settings/privacy)",
}


def _run_eval_capped(orid: str, runs: int, timeout_s: int) -> tuple[bool, str]:
    """Run the eval in a child process with a wall-clock cap. Returns (ok, error)."""
    ctx = mp.get_context("spawn")
    p = ctx.Process(target=_eval_worker, args=(orid, runs, _publish_enabled()), daemon=False)
    p.start()
    p.join(timeout_s)
    if p.is_alive():
        p.terminate()
        p.join(10)
        return False, f"timeout after {timeout_s}s (endpoint too slow / hung)"
    if p.exitcode != 0:
        reason = _EXIT_REASON.get(p.exitcode, "likely all provider calls errored")
        return False, f"eval failed (exit {p.exitcode}) — {reason}"
    return True, ""


def _published_row(model_id: str) -> dict | None:
    """Read the row the eval just wrote into web/lib/data.json (id = orid after the slash)."""
    if not WEB_DATA.exists():
        return None
    data = json.loads(WEB_DATA.read_text())
    row = next((r for r in data.get("rows", []) if r.get("id") == model_id), None)
    if row is None:
        return None
    return {"row": row, "n_models": data.get("n_models"),
            "baseline_label": data.get("baseline_label"), "baseline_acc": data.get("baseline_acc")}


def _trigger_vercel(hook_url: str) -> None:
    if not hook_url:
        print("watch: VERCEL_DEPLOY_HOOK_URL unset — site data updated locally but not redeployed")
        return
    try:
        req = urllib.request.Request(hook_url, data=b"{}",
                                     headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=20) as r:
            print(f"watch: triggered Vercel deploy hook (HTTP {r.status})")
    except Exception as e:  # noqa: BLE001 — publish trigger is best-effort
        print(f"watch: Vercel deploy hook failed: {type(e).__name__}: {e}")


def poll(dry_run: bool = False) -> int:
    providers = {p for p in _env("FINEPRINT_WATCH_PROVIDERS").split(",") if p}
    runs = int(_env("FINEPRINT_N_RUNS") or N_RUNS)
    max_new = int(_env("FINEPRINT_WATCH_MAX_NEW") or "4")
    timeout_s = int(_env("FINEPRINT_WATCH_TIMEOUT") or "1800")
    max_age_days = int(_env("FINEPRINT_WATCH_MAX_AGE") or "45")
    retry_failed = _env("FINEPRINT_WATCH_RETRY_FAILED") == "1"
    site_url = _env("FINEPRINT_SITE_URL") or _env("NEXT_PUBLIC_SITE_URL") or "https://fineprint.bench"
    slack = _env("SLACK_WEBHOOK_URL")
    vercel = _env("VERCEL_DEPLOY_HOOK_URL")

    catalog = _fetch_catalog()
    eligible = [m for m in catalog if _eligible(m, providers)]
    catalog_high = max((int(m.get("created", 0)) for m in eligible), default=0)

    state = _load_seen()
    if not state:  # first ever run → seed 'seen' to everything current, benchmark nothing
        _save_seen({m["id"] for m in eligible}, catalog_high)
        print(f"watch: initialized seen-set with {len(eligible)} models (high_water={catalog_high}). "
              f"No evals on the first run — genuinely-new models are picked up from here on.")
        return 0

    seen = set(state.get("seen", []))
    now = int(time.time())
    age_floor = now - max_age_days * 86400

    fresh = [m for m in eligible if m["id"] not in seen]
    new = [m for m in fresh if int(m.get("created", 0)) >= age_floor]
    stale = [m for m in fresh if int(m.get("created", 0)) < age_floor]  # too old: mark seen, skip
    new.sort(key=lambda m: int(m.get("created", 0)))                    # oldest-new first

    print(f"watch: {len(eligible)} eligible models, {len(new)} genuinely new"
          + (f" (+{len(stale)} older-than-{max_age_days}d ignored)" if stale else ""))
    for m in new:
        print(f"  NEW  {m['id']}  (created {m.get('created')})")

    if dry_run:
        print("watch: --dry-run, doing nothing.")
        return len(new)

    # older-than-window models are recorded as seen so we don't reconsider them every poll
    for m in stale:
        seen.add(m["id"])

    batch = new[:max_new]
    if len(new) > max_new:
        print(f"watch: capping this poll at {max_new}; {len(new) - max_new} will run next poll")

    published, warnings = [], []
    for m in batch:
        orid = m["id"]
        model_id = orid.split("/", 1)[1]
        label = (m.get("name") or orid).split(":", 1)[-1].strip()
        print(f"\nwatch: evaluating {label} ({orid}) — {runs} runs/contract, cap {timeout_s}s")
        ok, err = _run_eval_capped(orid, runs, timeout_s)
        if ok and not _publish_enabled():
            # Benchmarked fine, but the board write is withheld on purpose (see _publish_enabled).
            # Mark it seen anyway: evaluate() calls merge_into_results() BEFORE the publish gate, so
            # the raw runs are already banked in runs.json. Re-polling would re-pay for calls we
            # already have. When the board and corpus are reconciled, a single export.build() picks
            # every withheld model up from those saved runs — no re-benchmarking.
            seen.add(orid)
            warnings.append((label, orid, "benchmarked OK — runs banked, board write held "
                                          "(FINEPRINT_WATCH_PUBLISH=0 until board/corpus agree)"))
            print(f"watch: {label} benchmarked + banked; publish withheld by FINEPRINT_WATCH_PUBLISH=0")
        elif ok:
            info = _published_row(model_id)
            if info:
                published.append(info)
                seen.add(orid)
                print(f"watch: published {label} — rank #{info['row'].get('rank')}")
            else:
                warnings.append((label, orid, "eval ran but no published row found"))
                seen.add(orid)
        else:
            warnings.append((label, orid, err))
            if not retry_failed:
                seen.add(orid)   # skip permanently so a broken endpoint isn't re-hammered

    # ── announce + publish ────────────────────────────────────────────────────
    for info in published:
        text, blocks = notify.build_launch_blocks(
            info["row"], site_url, info.get("n_models") or 0,
            info.get("baseline_label"), info.get("baseline_acc"))
        notify.post_slack(slack, text, blocks)
    for label, orid, err in warnings:
        text, blocks = notify.build_warning_blocks(label, orid, err)
        notify.post_slack(slack, text, blocks)

    if published:
        _trigger_vercel(vercel)   # only redeploy when the site data actually changed

    # high-water advances to the newest thing we've now accounted for
    _save_seen(seen, max(catalog_high, state.get("high_water", 0)))
    print(f"\nwatch: done — {len(published)} published, {len(warnings)} skipped, "
          f"{len(seen)} models now seen.")
    return len(published)


def main() -> None:
    ap = argparse.ArgumentParser(prog="fineprint.watch",
                                 description="Detect, benchmark, publish & announce new models.")
    ap.add_argument("--dry-run", action="store_true", help="list new models, evaluate nothing")
    ap.add_argument("--init", action="store_true",
                    help="(re)seed the seen-set to the current catalog and exit (no evals)")
    a = ap.parse_args()
    if a.init:
        catalog = _fetch_catalog()
        providers = {p for p in _env("FINEPRINT_WATCH_PROVIDERS").split(",") if p}
        eligible = [m for m in catalog if _eligible(m, providers)]
        high = max((int(m.get("created", 0)) for m in eligible), default=0)
        _save_seen({m["id"] for m in eligible}, high)
        print(f"watch: seeded {len(eligible)} models into {SEEN_FILE.name}. No evals.")
        return
    poll(dry_run=a.dry_run)


if __name__ == "__main__":
    main()
