"""FinePrint benchmark runner.

For every model x seed contract x N runs: call the model, score against private ground truth,
record accuracy / cost tokens / latency / hallucinations / failures. Persists every raw run to
``results/runs.json`` (aggregation happens later, so we keep the full distribution — needed for
mean +/- sigma consistency and p50/p90 latency).

    python3 -m fineprint.run                 # all curated models
    python3 -m fineprint.run gpt-5.6-sol     # named subset

For the single-command flow (run + score + aggregate + publish in one shot), use
``python3 -m fineprint.eval <model>`` instead.
"""
import json
import pickle
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from fineprint.config import (all_models, SEED_CONTRACTS, N_RUNS, MAX_WORKERS,
                              OCR_DIR, RESULTS, AUDIT_DIR, OVERRIDES_DIR)
from fineprint.providers import build_user, call
from fineprint.scoring import load_truth, score, score_detail

_RULES = ((OVERRIDES_DIR / "default.md").read_text() + "\n\n" +
          (OVERRIDES_DIR / "base_client.md").read_text())


def _run_one(model, disp, user, truth, audit=False):
    rec = {"model": model["id"], "contract": disp, "ok": False}
    try:
        fields, usage, latency = call(model, user)
        rec.update(ok=True, latency=round(latency, 2), **usage, **score(fields, truth))
        if audit:
            rec["_audit"] = score_detail(fields, truth)  # stripped before runs.json; written to results/audit/
    except Exception as e:  # noqa: BLE001 — one call's failure must not stall the run
        rec["error"] = f"{type(e).__name__}: {str(e)[:140]}"
    return rec


def _write_audit(records: list[dict]) -> None:
    """Fold in-memory per-field detail into private results/audit/<model>.jsonl (one line per run)."""
    AUDIT_DIR.mkdir(parents=True, exist_ok=True)
    by_model: dict[str, list[str]] = {}
    for r in records:
        if "_audit" in r:
            by_model.setdefault(r["model"], []).append(
                json.dumps({"contract": r["contract"], "correct": r.get("correct"),
                            "scored": r.get("scored"), "fields": r.pop("_audit")}))
    for mid, lines in by_model.items():
        (AUDIT_DIR / f"{mid}.jsonl").write_text("\n".join(lines) + "\n")
    if by_model:
        print(f"  audit -> {AUDIT_DIR} ({sum(len(v) for v in by_model.values())} runs, {len(by_model)} models)")


def _prep():
    """Build each contract prompt once (identical across models/runs) + load its ground truth."""
    prompts, truths = {}, {}
    for disp, folder in SEED_CONTRACTS:
        doc = pickle.loads((OCR_DIR / f"{folder}.pkl").read_bytes())
        prompts[disp] = build_user(doc, _RULES)
        truths[disp] = load_truth(disp)
    return prompts, truths


def run_models(models: list[dict], n_runs: int = N_RUNS, workers: int = MAX_WORKERS,
               audit: bool = False, log=print) -> list[dict]:
    """Execute models x contracts x n_runs and return the raw run records (no I/O).

    ``audit=True`` also writes per-field expected/predicted tables to the private results/audit/.
    """
    prompts, truths = _prep()
    tasks = [(m, disp) for m in models for disp, _ in SEED_CONTRACTS for _ in range(n_runs)]
    log(f"FinePrint: {len(models)} model(s) x {len(SEED_CONTRACTS)} contracts x {n_runs} runs "
        f"= {len(tasks)} calls")
    results, t0 = [], time.time()
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = [ex.submit(_run_one, m, disp, prompts[disp], truths[disp], audit) for m, disp in tasks]
        for i, fut in enumerate(as_completed(futs), 1):
            r = fut.result(); results.append(r)
            tag = f"{r['correct']}/{r['scored']} {r['latency']}s" if r["ok"] else r.get("error", "ERR")
            log(f"  [{i}/{len(tasks)}] {r['model']:26} {r['contract']:20} {tag}")
    if audit:
        _write_audit(results)          # consumes and strips each rec's _audit key
    ok = sum(r["ok"] for r in results)
    log(f"done in {int(time.time()-t0)}s — {ok}/{len(results)} calls succeeded")
    return results


def merge_into_results(new_runs: list[dict], n_runs: int = N_RUNS) -> None:
    """Persist new run records to runs.json, replacing any prior runs for the same model ids."""
    RESULTS.parent.mkdir(parents=True, exist_ok=True)
    existing = json.loads(RESULTS.read_text())["runs"] if RESULTS.exists() else []
    replaced = {r["model"] for r in new_runs}
    kept = [r for r in existing if r["model"] not in replaced]
    RESULTS.write_text(json.dumps({"n_runs": n_runs, "runs": kept + new_runs}, indent=1))


def main(only: set[str] | None = None) -> None:
    models = [m for m in all_models() if not only or m["id"] in only]
    results = run_models(models)
    RESULTS.parent.mkdir(parents=True, exist_ok=True)
    RESULTS.write_text(json.dumps({"n_runs": N_RUNS, "runs": results}, indent=1))
    print(f"-> {RESULTS}", flush=True)


if __name__ == "__main__":
    main(only=set(sys.argv[1:]) or None)
