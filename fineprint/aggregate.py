"""Aggregate raw benchmark runs into per-model metrics.

Pure functions over the runs list — no I/O, no model calls — so they're cheap to unit-test.
Output is per-model (accuracy, hallucination, cost, latency, run-to-run sigma, reliability);
it carries no contract identities, so it is safe to publish.
"""
import json
from pathlib import Path
from statistics import mean, pstdev


def pct(a: float, b: float) -> float:
    return round(a / b * 100, 1) if b else 0.0


def _percentile(sorted_vals: list[float], q: float) -> float:
    if not sorted_vals:
        return 0.0
    return sorted_vals[min(len(sorted_vals) - 1, int(len(sorted_vals) * q))]


def aggregate(runs: list[dict], models: list[dict], contracts: list[tuple]) -> tuple[list[dict], dict]:
    """Fold raw runs into ranked per-model rows + corpus stats.

    Returns (rows sorted by accuracy desc with 1-based ``rank``, {fields_per_contract, total_judgments}).
    """
    names = [c[0] for c in contracts]
    out, total_judgments = [], 0
    for m in models:
        ok = [r for r in runs if r["model"] == m["id"] and r["ok"]]
        rs = [r for r in runs if r["model"] == m["id"]]
        if not ok:
            continue
        correct = sum(r["correct"] for r in ok)
        scored = sum(r["scored"] for r in ok)
        high = sum(r["high"] for r in ok)
        confident_wrong = sum(r["confident_wrong"] for r in ok)
        total_judgments += scored
        # run-to-run consistency: mean sigma of per-contract accuracy across the N runs
        sigmas = []
        for disp in names:
            accs = [pct(r["correct"], r["scored"]) for r in ok if r["contract"] == disp and r["scored"]]
            if len(accs) > 1:
                sigmas.append(pstdev(accs))
        lat = sorted(r["latency"] for r in ok)
        avg_in = mean(r["in"] for r in ok)
        avg_out = mean(r["out"] for r in ok)
        cost_1k = (avg_in / 1e6 * m["price_in"] + avg_out / 1e6 * m["price_out"]) * 1000
        accuracy = pct(correct, scored)
        out.append({
            "id": m["id"], "label": m["label"], "family": m["family"], "brand": m.get("brand", "openai"),
            "new": m.get("new", False), "est": m.get("est", False),
            "accuracy": accuracy,
            "halluc": pct(confident_wrong, high),
            "consistency": round(mean(sigmas), 1) if sigmas else 0.0,
            "cost_1k": round(cost_1k, 1),
            "cost_contract": round(cost_1k / 1000, 4),
            "p50": round(_percentile(lat, 0.5), 1),
            "p90": round(_percentile(lat, 0.9), 1),
            "avg_lat": round(mean(lat), 1),
            "in_tok": round(avg_in), "out_tok": round(avg_out),
            "reasoning": round(mean(r["reasoning"] for r in ok)),
            "reliability": pct(len(ok), len(rs)),
            "value": round(accuracy / cost_1k, 2) if cost_1k else 0.0,  # accuracy points per $/1k
            "avg_scored": round(scored / len(ok), 1),
            "calls": len(rs),
        })
    out.sort(key=lambda r: -r["accuracy"])
    for i, r in enumerate(out):
        r["rank"] = i + 1
    fields_per_contract = round(mean(r["avg_scored"] for r in out)) if out else 0
    return out, {"fields_per_contract": fields_per_contract, "total_judgments": total_judgments}


def load_runs(path) -> list[dict]:
    return json.loads(Path(path).read_text())["runs"]
