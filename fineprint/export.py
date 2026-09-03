"""Build the anonymized, publishable web dataset from raw runs.

Writes ``web/lib/data.json`` (consumed by the Next.js app). Per-model aggregates only — no
contract identities — so nothing private leaves the harness. Raw ``runs.json`` stays gitignored.

    python3 -m fineprint.export
"""
import json
import os

from statistics import mean

from fineprint.config import all_models, SEED_CONTRACTS, N_RUNS, RESULTS, WEB_DATA, BASELINE_ID
from fineprint.aggregate import aggregate, load_runs, pct
from fineprint import pricing

# A model whose calls mostly FAILED still aggregates into a row: ``aggregate`` scores whatever
# handful of calls survived and gates only on there being at least one. That is a failed
# measurement, not a bad model — but the board ranks on accuracy alone and says nothing about
# sample size, so it lands next to models measured over the full corpus. (An OpenRouter 402 once
# failed 172 of 174 calls; the 2 survivors published as a real score at rank #30.) Publish only
# rows measured over enough of the corpus to mean anything.
MIN_RELIABILITY = float(os.environ.get("FINEPRINT_MIN_RELIABILITY", "50"))


def _contract_matrix(runs: list[dict], rows: list[dict]) -> dict:
    """Per (model, contract) mean accuracy, contracts ANONYMIZED as Doc A..F (stable seed order).

    Safe to publish: carries difficulty, never contract identities. Powers the difficulty heatmap.
    """
    names = [c[0] for c in SEED_CONTRACTS]
    labels = [f"Doc {chr(65 + i)}" if len(names) <= 26 else f"Doc {i + 1:02d}" for i in range(len(names))]
    matrix = {}
    for r in rows:
        accs = []
        for disp in names:
            runs_mc = [x for x in runs if x["model"] == r["id"] and x["contract"] == disp and x["ok"] and x["scored"]]
            accs.append(round(mean(pct(x["correct"], x["scored"]) for x in runs_mc), 1) if runs_mc else None)
        matrix[r["id"]] = accs
    valid = lambda i: [matrix[r["id"]][i] for r in rows if matrix[r["id"]][i] is not None]
    difficulty = [round(mean(valid(i)), 1) if valid(i) else None for i in range(len(names))]
    return {"labels": labels, "difficulty": difficulty, "matrix": matrix}


def build() -> dict:
    prices = pricing.load()  # OpenRouter source of truth (falls back to config prices)
    priced = [{**m, **{k: prices[m["id"]][k] for k in ("price_in", "price_out")}} if m["id"] in prices else m
              for m in all_models()]
    raw = json.loads(RESULTS.read_text())
    runs, n_runs = raw["runs"], raw.get("n_runs", N_RUNS)   # report the ACTUAL runs/contract, not the config default
    rows, stats = aggregate(runs, priced, SEED_CONTRACTS)
    baseline = next((r for r in rows if r["id"] == BASELINE_ID), None)
    newest = next((r for r in rows if r["new"]), rows[0] if rows else None)
    data = {
        "rows": rows,
        "n_runs": n_runs,
        "n_contracts": len(SEED_CONTRACTS),
        "n_models": len(rows),
        "fields_per_contract": stats["fields_per_contract"],
        "total_judgments": stats["total_judgments"],
        "baseline_acc": baseline["accuracy"] if baseline else None,
        "baseline_label": baseline["label"] if baseline else None,
        "newest_id": newest["id"] if newest else None,
        "contracts": _contract_matrix(runs, rows),
    }
    WEB_DATA.parent.mkdir(parents=True, exist_ok=True)
    WEB_DATA.write_text(json.dumps(data, indent=2))
    print(f"wrote {WEB_DATA} — {len(rows)} models, {stats['total_judgments']} field judgments")
    return data


def add_model(model_id: str) -> dict | None:
    """Publish ONE model onto the existing board, leaving every other row untouched.

    ``build()`` recomputes the whole board from ``runs.json``. That is only correct while runs.json
    still covers every published model over the same contracts — not guaranteed for a long-lived
    board. When it is not true, publishing a single new model silently rewrites everyone else's
    numbers against whatever contracts happen to be in runs.json. This function exists so the
    autopilot can add a model without that risk.

    Existing rows are copied verbatim; only ``rank`` moves as the new row is slotted in by accuracy.
    Returns the published board, or None when the model has no usable runs.
    """
    if not WEB_DATA.exists():
        return build()                       # no board yet — nothing to preserve
    board = json.loads(WEB_DATA.read_text())
    existing = [r for r in board.get("rows", []) if r["id"] != model_id]

    models = [m for m in all_models() if m["id"] == model_id]
    if not models:
        return None
    prices = pricing.load()
    models = [{**m, **{k: prices[m["id"]][k] for k in ("price_in", "price_out")}} if m["id"] in prices else m
              for m in models]
    runs = [r for r in load_runs(RESULTS) if r["model"] == model_id]
    if not runs:
        return None
    rows, _ = aggregate(runs, models, SEED_CONTRACTS)
    new = next((r for r in rows if r["id"] == model_id), None)
    if not new:
        return None
    if new.get("reliability", 100.0) < MIN_RELIABILITY:
        print(f"skipped {model_id} — only {new.get('reliability')}% of {new.get('calls')} calls succeeded "
              f"(min {MIN_RELIABILITY}%); board unchanged")
        return None

    merged = existing + [new]
    merged.sort(key=lambda r: -r["accuracy"])
    for i, r in enumerate(merged, 1):
        r["rank"] = i
    board["rows"] = merged
    board["n_models"] = len(merged)
    board["newest_id"] = model_id
    WEB_DATA.write_text(json.dumps(board, indent=2))
    print(f"published {model_id} -> rank #{new['rank']} of {len(merged)} (other rows untouched)")
    return board


if __name__ == "__main__":
    build()
