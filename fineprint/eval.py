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
from fineprint.providers import DEFAULT_REASONING_EFFORT, REASONING_MAX_TOKENS
from fineprint.run import run_models, merge_into_results

_CATALOG_URL = "https://openrouter.ai/api/v1/models"

# Distinct exit codes so the watch loop can report an honest reason instead of always blaming the
# provider calls. UNRESOLVABLE = the model id isn't on OpenRouter (a withdrawn/renamed stealth
# variant, or a bad spec); ALL_FAILED = it resolved but every provider call errored for reasons this
# service can retry past; POLICY_BLOCKED = every provider call was rejected by THIS OpenRouter
# account's own privacy/data-policy settings — not a bug, and not something a code fix can route
# around (that's the point of the setting). Only a human with dashboard access can decide to relax it.
EXIT_UNRESOLVABLE = 3
EXIT_ALL_FAILED = 2
EXIT_POLICY_BLOCKED = 4

# OpenRouter's own wording when an account's configured data-collection/guardrail policy excludes
# every provider that could serve a model (e.g. "only zero-retention providers") — verbatim from a
# live 404 hit while diagnosing deepseek/deepseek-v4-flash-vision-exp. Matched, not parsed: OpenRouter
# doesn't give this a machine-readable error code.
_POLICY_BLOCKED_MARKER = "no endpoints available matching your guardrail restrictions and data policy"


def _die(msg: str, code: int) -> None:
    print(msg, file=sys.stderr)
    sys.exit(code)


def resolve(spec: str) -> dict:
    """Turn a CLI spec into a model dict. Curated id wins; otherwise treat it as an OpenRouter id."""
    by_id = {m["id"]: m for m in all_models()}
    if spec in by_id:
        return by_id[spec]
    if "/" not in spec:
        _die(f"unknown model '{spec}' — pass a curated id or a full OpenRouter id like "
             f"'anthropic/claude-opus-5'", EXIT_UNRESOLVABLE)
    catalog = {m["id"]: m for m in json.load(urllib.request.urlopen(_CATALOG_URL, timeout=40))["data"]}
    entry = catalog.get(spec)
    if not entry:
        _die(f"'{spec}' is not on OpenRouter — likely a withdrawn or renamed stealth/preview "
             f"variant. Nothing to benchmark; skipping.", EXIT_UNRESOLVABLE)
    prefix = spec.split("/", 1)[0]
    p = entry.get("pricing", {})
    label = entry.get("name", spec).split(":", 1)[-1].strip()  # "OpenAI: GPT-X" -> "GPT-X"
    sup = list(entry.get("supported_parameters") or [])
    is_reasoner = "reasoning_effort" in sup or "reasoning" in sup
    model = {
        "id": spec.split("/", 1)[1], "label": label, "family": label,
        "provider": "openrouter", "openrouter_id": spec,
        "brand": BRAND.get(prefix, prefix),
        "price_in": round(float(p.get("prompt", 0)) * 1e6, 4),
        "price_out": round(float(p.get("completion", 0)) * 1e6, 4),
        # Wire the provider's real capabilities through so providers.call() can skip attempts the
        # model can't do (e.g. strict json_schema when structured_outputs is unsupported) instead of
        # burning attempt-1. A reasoner gets a conservative effort + a token cap so it can't
        # over-reason into the client timeout — scoped here, so the curated roster is untouched.
        "supported_parameters": sup,
        "effort": DEFAULT_REASONING_EFFORT if is_reasoner else None,
        "max_tokens": REASONING_MAX_TOKENS if is_reasoner else None,
        "new": True,
    }
    register_model(model)
    print(f"registered ad-hoc model: {model['label']} ({spec}) -> roster.json"
          + (f"  [reasoner: effort=low]" if is_reasoner else ""))
    return model


def evaluate(spec: str, runs: int = N_RUNS, workers: int = MAX_WORKERS,
             publish: bool = True, dump: bool = False) -> None:
    model = resolve(spec)
    print(f"\n=== FinePrint · {model['label']} ({model['openrouter_id']}) ===")
    records = run_models([model], n_runs=runs, workers=workers, audit=dump)
    merge_into_results(records, n_runs=runs)

    if not any(r["ok"] for r in records):
        errs = {r.get("error", "?") for r in records}
        if errs and all(_POLICY_BLOCKED_MARKER in e.lower() for e in errs):
            _die(f"\n{model['label']} is blocked by this OpenRouter account's own privacy/data-policy "
                 f"settings — no provider for this model meets the configured guardrails. Not a bug; "
                 f"review https://openrouter.ai/settings/privacy if you want this model included.\n  "
                 + "\n  ".join(sorted(errs)), EXIT_POLICY_BLOCKED)
        _die(f"\nall calls failed for {model['label']}:\n  " + "\n  ".join(sorted(errs)),
             EXIT_ALL_FAILED)

    pricing.refresh()                      # price the (possibly new) model from OpenRouter
    # Additive publish: slot THIS model into the board and leave every other row byte-identical.
    # A full export.build() would recompute the whole board from runs.json, so publishing one new
    # model would silently rescore every other model against whatever contracts runs.json holds.
    data = export.add_model(model["id"]) if publish else None
    if not data:
        return
    row = next((r for r in data["rows"] if r["id"] == model["id"]), None)
    if not row:
        return
    print(f"\n  {model['label']}  —  rank #{row['rank']} of {data['n_models']}")
    cost_str = f"${row['cost_1k']}" if row.get("cost_1k") is not None else "NA (free / price unlisted)"
    value_str = f"{row['value']}  (accuracy pts per $/1k)" if row.get("value") is not None else "NA (no listed price)"
    for label, val in [
        ("accuracy",        f"{row['accuracy']}%"),
        ("hallucination",   f"{row['halluc']}%  (confident & wrong)"),
        ("consistency",     f"±{row['consistency']} pts across {runs} runs"),
        ("cost / 1k",       cost_str),
        ("value",           value_str),
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
