"""Run directory -> fineprint/web/lib/finance-reasoning.json (aggregates only; no items, no replies).

    python -m fineprint.oss.export fineprint/results/finreason
"""
import argparse
import datetime
import json
from pathlib import Path

from fineprint.oss import finreason

LABELS = {"gpt-6-astra": ("GPT-6 Astra", "openai"), "gpt-5.5": ("GPT-5.5", "openai"), "gpt-5.6-sol": ("GPT-5.6 Sol", "openai"),
          "gpt-5.6-terra": ("GPT-5.6 Terra", "openai"), "gpt-5.6-luna": ("GPT-5.6 Luna", "openai"),
          "gpt-5.4-mini": ("GPT-5.4 Mini", "openai"), "gpt-5.4-nano": ("GPT-5.4 Nano", "openai")}
OUT = Path(__file__).parents[1] / "web" / "lib" / "finance-reasoning.json"


def build(run_dir: Path) -> dict:
    records = [json.loads(line) for line in (run_dir / "items.jsonl").read_text().splitlines()]
    total = len(finreason.items())
    rows = [r for r in finreason.summarize(records) if r["n"] + r["unscored"] >= total]      # complete runs only
    rows.sort(key=lambda r: (-r["accuracy"], r["cost_total"]))                               # ties: cheaper first
    models = []
    for r in rows:
        label, brand = LABELS.get(r["model"], (r["model"].split("/")[-1], r["model"].split("/")[0]))
        rank = next(i for i, x in enumerate(rows, 1) if x["accuracy"] == r["accuracy"])      # equal accuracy, equal rank
        models.append({"id": r["model"], "label": label, "brand": brand, "rank": rank, "accuracy": r["accuracy"], "ci": r["ci95"],
                       "n": r["n"], "unscored": r["unscored"], "cost_total": r["cost_total"], "latency": r["latency"]})
    return {"updated": datetime.date.today().isoformat(), "items": total, "effort": "low", "seed": finreason.SEED, "priced_as_of": finreason.PRICED_AS_OF, "models": models}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("run_dir", type=Path)
    data = build(ap.parse_args().run_dir)
    OUT.write_text(json.dumps(data, indent=1) + "\n")
    print(f"wrote {OUT} — {len(data['models'])} models")
