"""Build the anonymized, publishable web dataset from raw runs.

Writes ``web/lib/data.json`` (consumed by the Next.js app). Per-model aggregates only — no
contract identities — so nothing private leaves the harness. Raw ``runs.json`` stays gitignored.

    python3 -m fineprint.export
"""
import json

from statistics import mean

from fineprint.config import all_models, SEED_CONTRACTS, N_RUNS, RESULTS, WEB_DATA, BASELINE_ID
from fineprint.aggregate import aggregate, load_runs, pct
from fineprint import pricing


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


if __name__ == "__main__":
    build()
