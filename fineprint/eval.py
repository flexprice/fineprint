"""FinePrint — one command to benchmark a model end to end.

    python3 -m fineprint.eval gpt-5.6-luna              # a curated model
    python3 -m fineprint.eval anthropic/claude-opus-5   # any OpenRouter model, resolved live
    python3 -m fineprint.eval qwen/qwen3.8-max --runs 3 # override runs/contract

It runs the model across the private contract set, scores every field, folds the raw runs into
metrics (accuracy, hallucination, cost, latency, run-to-run sigma, value, reliability), merges
them into ``results/runs.json``, and republishes the anonymized ``web/lib/data.json`` the site
reads — so the model appears on the leaderboard immediately. A model that isn't in the curated
catalog is resolved from OpenRouter (name, lab, live pricing) and remembered in ``roster.json``.
"""
import argparse
import json
import sys
import urllib.request

from fineprint.config import all_models, register_model, BRAND, N_RUNS, MAX_WORKERS
from fineprint import pricing, export
from fineprint.run import run_models, merge_into_results

_CATALOG_URL = "https://openrouter.ai/api/v1/models"


def resolve(spec: str) -> dict:
    """Turn a CLI spec into a model dict. Curated id wins; otherwise treat it as an OpenRouter id."""
    by_id = {m["id"]: m for m in all_models()}
    if spec in by_id:
        return by_id[spec]
    if "/" not in spec:
        sys.exit(f"unknown model '{spec}' — pass a curated id or a full OpenRouter id like "
                 f"'anthropic/claude-opus-5'")
    catalog = {m["id"]: m for m in json.load(urllib.request.urlopen(_CATALOG_URL, timeout=40))["data"]}
    entry = catalog.get(spec)
    if not entry:
        sys.exit(f"'{spec}' not found on OpenRouter")
    prefix = spec.split("/", 1)[0]
    p = entry.get("pricing", {})
    label = entry.get("name", spec).split(":", 1)[-1].strip()  # "OpenAI: GPT-X" -> "GPT-X"
    model = {
        "id": spec.split("/", 1)[1], "label": label, "family": label,
        "provider": "openrouter", "openrouter_id": spec,
        "brand": BRAND.get(prefix, prefix),
        "price_in": round(float(p.get("prompt", 0)) * 1e6, 4),
        "price_out": round(float(p.get("completion", 0)) * 1e6, 4),
        "effort": None, "new": True,
    }
    register_model(model)
    print(f"registered ad-hoc model: {model['label']} ({spec}) -> roster.json")
    return model


def evaluate(spec: str, runs: int = N_RUNS, workers: int = MAX_WORKERS,
             publish: bool = True, dump: bool = False) -> None:
    model = resolve(spec)
    print(f"\n=== FinePrint · {model['label']} ({model['openrouter_id']}) ===")
    records = run_models([model], n_runs=runs, workers=workers, audit=dump)
    merge_into_results(records, n_runs=runs)

    if not any(r["ok"] for r in records):
        errs = {r.get("error", "?") for r in records}
        sys.exit(f"\nall calls failed for {model['label']}:\n  " + "\n  ".join(sorted(errs)))

    pricing.refresh()                      # price the (possibly new) model from OpenRouter
    data = export.build() if publish else None
    if not data:
        return
    row = next((r for r in data["rows"] if r["id"] == model["id"]), None)
    if not row:
        return
    print(f"\n  {model['label']}  —  rank #{row['rank']} of {data['n_models']}")
    for label, val in [
        ("accuracy",        f"{row['accuracy']}%"),
        ("hallucination",   f"{row['halluc']}%  (confident & wrong)"),
        ("consistency",     f"±{row['consistency']} pts across {runs} runs"),
        ("cost / 1k",       f"${row['cost_1k']}"),
        ("value",           f"{row['value']}  (accuracy pts per $/1k)"),
        ("latency p50/p90", f"{row['p50']}s / {row['p90']}s"),
        ("reliability",     f"{row['reliability']}%  ({row['calls']} calls)"),
    ]:
        print(f"    {label:18} {val}")
    print(f"\n  published -> {data['n_models']} models now on the site")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(prog="fineprint.eval", description="Benchmark one model end to end.")
    ap.add_argument("model", help="curated id (gpt-5.6-luna) or OpenRouter id (anthropic/claude-opus-5)")
    ap.add_argument("--runs", type=int, default=N_RUNS, help=f"runs per contract (default {N_RUNS})")
    ap.add_argument("--workers", type=int, default=MAX_WORKERS, help=f"concurrency (default {MAX_WORKERS})")
    ap.add_argument("--no-publish", action="store_true", help="score only; don't rewrite the site data")
    ap.add_argument("--dump", action="store_true", help="also write per-field audit tables to results/audit/ (private)")
    a = ap.parse_args()
    evaluate(a.model, runs=a.runs, workers=a.workers, publish=not a.no_publish, dump=a.dump)
