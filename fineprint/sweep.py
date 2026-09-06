"""Re-baseline the whole board in one pass: every model, one corpus, one set of rules.

``fineprint.eval`` publishes ONE model additively onto an existing board, which is right for a
newly-shipped model but cannot repair a board whose rows were measured on different document sets.
This runs many models in a single interleaved sweep and rebuilds the board from scratch, so every
published row comes from the same corpus, the same code, and the same routing.

Designed to run as a Cloud Run Job rather than through the service: a full sweep takes hours, well
past the 3600s request timeout, and it needs the same region (and therefore the same network
vantage) as the watch loop so the latencies stay comparable to future runs.

    python -m fineprint.sweep --models all --runs 1 --workers 30 --publish
    python -m fineprint.sweep --models <cheap ids...> --runs 1          # probe, no publish
    python -m fineprint.sweep --models all --direct --publish           # one-time direct routing

``--direct`` bills first-party labs through their own APIs (see providers.route_for). It exists for
this one re-baseline; nothing else sets it, so every model added afterwards goes via OpenRouter.
"""
import argparse
import json
import sys
import time
from pathlib import Path

from fineprint import bootstrap, config, export, preflight, pricing, store, watch
from fineprint.config import MAX_WORKERS, N_RUNS, RESULTS, all_models
from fineprint.run import merge_into_results, run_models

_STATE = {
    "state/runs.json": config.RESULTS,
    "state/data.json": config.WEB_DATA,
    "state/roster.json": config.ROSTER_FILE,
    "state/seen_models.json": watch.SEEN_FILE,
}


def apply_max_tokens(models: list[dict], cap: int) -> None:
    """Give every model without its own cap a generation ceiling.

    OpenRouter reserves each in-flight request against the model's maximum output, so models that
    send no ``max_tokens`` reserve their entire window. A few dozen concurrent calls then exceed the
    account balance and the whole sweep 402s with "would exceed your available credits given your
    current in-flight requests" — which is a concurrency problem wearing a billing error's clothes.
    Bounding it keeps the reservation small without truncating this schema (~5-7k tokens in
    practice). Models carrying an explicit cap keep it.
    """
    for m in models:
        m.setdefault("max_tokens", cap)


PARTIAL = "state/runs.partial.json"


def _save_partial(records: list[dict]) -> None:
    """Persist mid-sweep progress so a crash, cancel or timeout does not discard paid-for calls."""
    p = Path(config.RESULTS).with_suffix(".partial.json")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps({"runs": records}))
    if store.enabled():
        store.upload(p, PARTIAL)
    print(f"  checkpoint: {len(records)} records saved")


def _load_partial() -> list[dict]:
    """Records from an interrupted sweep, if any — so a rerun does not buy the same answers twice."""
    p = Path(config.RESULTS).with_suffix(".partial.json")
    if store.enabled():
        store.download(PARTIAL, p)
    if not p.exists():
        return []
    try:
        return json.loads(p.read_text()).get("runs", [])
    except (json.JSONDecodeError, OSError):
        return []


def apply_effort(models: list[dict], effort: str) -> None:
    """Force a reasoning effort across the models in this run.

    Effort is normally a per-model curated choice, and the published board keeps it that way. This
    exists for A/B diagnostics: measuring the same model at two efforts on the same corpus is the
    only way to tell a capability gap from a configuration artifact.
    """
    for m in models:
        m["effort"] = effort


def _sync_up() -> None:
    for obj, local in _STATE.items():
        if Path(local).exists():
            store.upload(Path(local), obj)


def _backup(tag: str) -> None:
    """Copy the mutable state aside before a sweep rewrites it. A re-baseline replaces every row;
    without this there is no way back to the board that was live five minutes ago."""
    stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    for obj, local in _STATE.items():
        if Path(local).exists():
            store.upload(Path(local), f"{obj}.bak-{tag}-{stamp}")
    print(f"backed up state -> *.bak-{tag}-{stamp}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Re-baseline many models over one fixed corpus.")
    ap.add_argument("--models", nargs="+", required=True, help="'all' or explicit model ids")
    ap.add_argument("--runs", type=int, default=N_RUNS)
    ap.add_argument("--workers", type=int, default=MAX_WORKERS)
    ap.add_argument("--direct", action="store_true", help="one-time first-party direct routing")
    ap.add_argument("--publish", action="store_true", help="rebuild and upload the board")
    ap.add_argument("--force", action="store_true", help="run even if preflight finds bad ids")
    ap.add_argument("--resume", action="store_true",
                    help="continue an interrupted sweep from its last checkpoint")
    ap.add_argument("--contracts", type=int, default=0,
                    help="use only the first N contracts (route-comparison runs, not for publishing)")
    ap.add_argument("--effort", default=None,
                    help="force reasoning effort for this run (diagnostic A/B; the board keeps the "
                         "curated per-model value)")
    ap.add_argument("--max-tokens", type=int, default=0,
                    help="cap generation on models that set none, bounding OpenRouter's per-request "
                         "credit reservation so concurrency does not trip a 402")
    ap.add_argument("--out", default=None,
                    help="write raw records here and skip merge/publish — for comparing two routes "
                         "without one overwriting the other in runs.json")
    args = ap.parse_args()

    bootstrap.main()

    universe = all_models()
    models = universe if args.models == ["all"] else [m for m in universe if m["id"] in set(args.models)]
    if not models:
        sys.exit(f"no models matched {args.models}")

    # A model whose id does not resolve fails every call and then publishes whatever survived.
    # Catch it here, for free, instead of discovering it in the aggregate.
    checks = preflight.check(models, args.direct)
    bad = [c for c in checks if c["status"] == "MISSING"]
    for c in bad:
        print(f"preflight MISSING: {c['id']} sends {c['wire']!r} on {c['route']}")
    if bad and not args.force:
        sys.exit(f"{len(bad)} model(s) would fail every call — fix or re-run with --force")
    if bad:
        models = [m for m in models if m["id"] not in {c["id"] for c in bad}]

    routes = {}
    for c in checks:
        routes[c["route"]] = routes.get(c["route"], 0) + 1
    print(f"sweeping {len(models)} models x {len(config.SEED_CONTRACTS)} contracts x {args.runs} run(s) "
          f"at {args.workers} workers; routes: {routes}")

    if args.effort:
        apply_effort(models, args.effort)
        print(f"forcing reasoning_effort={args.effort} for this run")

    if args.max_tokens:
        apply_max_tokens(models, args.max_tokens)
        print(f"capped generation at {args.max_tokens} tokens for models without their own limit")

    if args.contracts:
        # Trim the corpus in place; run_models reads SEED_CONTRACTS at call time.
        config.SEED_CONTRACTS[:] = config.SEED_CONTRACTS[:args.contracts]
        import fineprint.run as _run
        _run.SEED_CONTRACTS = config.SEED_CONTRACTS
        print(f"limited to the first {len(config.SEED_CONTRACTS)} contracts")

    if args.publish and store.enabled():
        _backup("sweep")

    prior = _load_partial() if args.resume else []
    done = {(r["model"], r["contract"]) for r in prior}
    if prior:
        print(f"resuming from checkpoint: {len(prior)} record(s) already banked")

    t0 = time.time()
    records = run_models(models, n_runs=args.runs, workers=args.workers, direct=args.direct,
                         checkpoint=_save_partial, checkpoint_every=25, done=done)
    records = prior + records
    ok = sum(r["ok"] for r in records)
    print(f"sweep done in {int(time.time()-t0)}s — {ok}/{len(records)} calls ok")

    if args.out:   # comparison run: keep the records intact, touch no shared state
        Path(args.out).write_text(json.dumps({"direct": args.direct, "runs": records}, indent=1))
        print(f"wrote {len(records)} records -> {args.out} (runs.json and the board untouched)")
        if store.enabled():   # the job's filesystem dies with the container
            store.upload(Path(args.out), f"compare/{Path(args.out).name}")
            print(f"uploaded -> gs://{store.BUCKET}/compare/{Path(args.out).name}")
        return
    merge_into_results(records, n_runs=args.runs)

    if args.publish:
        pricing.refresh()
        data = export.build()          # full rebuild: every row from the same corpus and runs
        print(f"published {data['n_models']} models over {data['n_contracts']} contracts")
    if store.enabled():
        _sync_up()
        print("state synced back to GCS")


if __name__ == "__main__":
    main()
