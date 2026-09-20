"""FinePrint on an open benchmark: FinanceReasoning, hard split (BUPT-Reasoning-Lab, CC BY 4.0).

    python -m fineprint.oss.finreason --models gpt-5.6-luna --n 80 --budget 0.2 --out fineprint/results/finreason

238 numeric finance problems over real filings and tables, each with a stated rounding rule and one numeric
answer. Nothing is ours to tune: the items and answers are the dataset's, and grading is numeric (within 0.2%
of the reference, the dataset paper's tolerance, or equal at the reference's own precision). The only choice we
make is which items to run when the budget does not cover all 238: the first --n of one fixed shuffle (SEED),
decided before any model is run, and the same items for every model.
"""
import argparse
import json
import os
import random
import re
import statistics
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal, InvalidOperation
from pathlib import Path

from openai import OpenAI

URL = "https://huggingface.co/datasets/BUPT-Reasoning-Lab/FinanceReasoning/resolve/main/FinanceReasoning/hard.json"
CACHE = Path(__file__).parent / ".cache" / "financereasoning_hard.json"
SEED = 20260920
_SYSTEM = ("You are a careful financial analyst. Work the problem, then end your reply with one line of the form\n"
           "ANSWER: <number>\nA bare number only: no units, currency signs, percent signs or thousands separators. If the question asks for\n"
           "True or False, give that word instead.")
_NUM = re.compile(r"-?\d+(?:\.\d+)?(?:[eE]-?\d+)?")
# USD per million tokens (in, out), equal to the roster in fineprint/config.py; an unlisted model is run but reported unpriced
PRICES = {"gpt-5.6-luna": (0.10, 0.60), "gpt-5.6-terra": (1, 6), "gpt-5.6-sol": (5, 30), "gpt-5.5": (5, 30),
          "gpt-6-astra": (10, 50), "gpt-5.4-mini": (0.75, 4.50), "gpt-5.4-nano": (0.20, 1.25)}
_lock, _spent = threading.Lock(), [0.0]


def _client(model: str) -> OpenAI:
    """A bare model id goes to OpenAI; an id with a slash goes to OpenRouter."""
    if "/" in model:
        return OpenAI(api_key=os.environ["OPENROUTER_API_KEY"], base_url="https://openrouter.ai/api/v1", max_retries=2, timeout=300)
    return OpenAI(api_key=os.environ["OPENAI_API_KEY"], max_retries=2, timeout=300)


def wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """95% Wilson interval for k successes in n trials, in percent."""
    if not n:
        return 0.0, 0.0
    p, d = k / n, 1 + z * z / n
    mid, half = (p + z * z / (2 * n)) / d, z * ((p * (1 - p) / n + z * z / (4 * n * n)) ** 0.5) / d
    return round(100 * max(0, mid - half), 1), round(100 * min(1, mid + half), 1)


def items(n: int | None = None) -> list:
    if not CACHE.exists():
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(URL, timeout=90) as r:
            CACHE.write_bytes(r.read())
    data = json.loads(CACHE.read_text())
    random.Random(SEED).shuffle(data)
    return [{"id": d["question_id"], "source": re.sub(r"-.*", "", d.get("source") or "other"), "answer": str(d["ground_truth"]),
             "prompt": (f"{d['context']}\n\n" if d.get("context") else "") + f"Question: {d['question']}"} for d in data[:n]]


def parse(reply: str) -> Decimal | None:
    tail = re.findall(r"ANSWER\s*:\s*([^\n]+)", reply or "", flags=re.I)
    found = _NUM.findall((tail[-1] if tail else (reply or "").strip().splitlines()[-1] if (reply or "").strip() else "").replace(",", ""))
    try:
        return Decimal(found[-1]) if found else None
    except InvalidOperation:
        return None


def correct(answer: str, reply: str) -> bool:
    if answer in ("True", "False"):                            # three items are yes/no questions
        tail = re.findall(r"ANSWER\s*:\s*([^\n]+)", reply or "", flags=re.I)
        return bool(tail) and tail[-1].strip().strip("'\".").lower() == answer.lower()
    got, want = parse(reply), Decimal(answer)
    if got is None:
        return False
    if abs(got - want) <= abs(want) * Decimal("0.002"):
        return True
    places = max(0, -want.as_tuple().exponent)                 # equal once rounded the way the reference is
    return round(got, places) == want


def ask(model: str, item: dict, effort: str | None, max_out: int) -> dict:
    direct = "/" not in model
    kw = {"model": model, "messages": [{"role": "system", "content": _SYSTEM}, {"role": "user", "content": item["prompt"]}],
          ("max_completion_tokens" if direct else "max_tokens"): max_out}
    if effort:
        kw["reasoning_effort"] = effort
    rec = {"model": model, "id": item["id"], "source": item["source"], "error": None, "right": None, "cost": 0.0}
    t0 = time.time()
    try:
        resp = _client(model).chat.completions.create(**kw)
    except Exception as e:  # noqa: BLE001 — a provider failure is unscored, never a wrong answer
        rec["error"] = f"{type(e).__name__}: {str(e)[:200]}"
        return rec
    reply = resp.choices[0].message.content or ""
    pin, pout = PRICES.get(model, (0, 0))
    rec.update(latency=round(time.time() - t0, 1), got=str(parse(reply)), want=item["answer"], right=correct(item["answer"], reply),
               priced=model in PRICES, cost=round(resp.usage.prompt_tokens / 1e6 * pin + resp.usage.completion_tokens / 1e6 * pout, 5),
               **{"in": resp.usage.prompt_tokens, "out": resp.usage.completion_tokens})
    return rec


def summarize(records: list) -> list:
    rows = []
    for model in sorted({r["model"] for r in records}):
        rs = [r for r in records if r["model"] == model and r["right"] is not None]
        if not rs:
            continue
        k = sum(r["right"] for r in rs)
        rows.append({"model": model, "n": len(rs), "accuracy": round(100 * k / len(rs), 1), "ci95": wilson(k, len(rs)),
                     "unscored": sum(1 for r in records if r["model"] == model and r["right"] is None),
                     "cost_total": round(sum(r["cost"] for r in rs), 3), "cost_per_item": round(sum(r["cost"] for r in rs) / len(rs), 4),
                     "latency": round(statistics.median(r["latency"] for r in rs), 1),      # median: means are wrecked by rate-limit retries
                     "out_tokens": round(sum(r["out"] for r in rs) / len(rs))})
    return sorted(rows, key=lambda r: -r["accuracy"])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", nargs="+", required=True)
    ap.add_argument("--n", type=int, help="first N items of the fixed shuffle (default: all 238)")
    ap.add_argument("--effort", default="low")
    ap.add_argument("--max-out", type=int, default=8000)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--budget", type=float, required=True, help="USD; stop starting new calls once spent")
    ap.add_argument("--out", type=Path, required=True)
    a = ap.parse_args()
    a.out.mkdir(parents=True, exist_ok=True)
    log = a.out / "items.jsonl"
    done = {(r["model"], r["id"]) for r in map(json.loads, log.read_text().splitlines()) if r["right"] is not None} if log.exists() else set()
    todo = [(m, it) for m in a.models for it in items(a.n) if (m, it["id"]) not in done]
    print(f"{len(todo)} calls to make ({len(done)} already recorded); budget ${a.budget}")

    def work(job):
        with _lock:
            if _spent[0] >= a.budget:
                return
        rec = ask(job[0], job[1], a.effort or None, a.max_out)
        with _lock:
            _spent[0] += rec["cost"]
            with log.open("a") as f:
                f.write(json.dumps(rec) + "\n")

    with ThreadPoolExecutor(a.workers) as pool:
        list(pool.map(work, todo))
    wanted = {it["id"] for it in items(a.n)}
    rows = summarize([r for r in map(json.loads, log.read_text().splitlines()) if r["id"] in wanted])
    (a.out / "summary.json").write_text(json.dumps(rows, indent=1))
    print(f"spent this run: ${_spent[0]:.2f}\n\n{'model':<18}{'acc':>7}{'95% CI':>15}{'n':>5}{'unsc':>6}{'$ total':>9}{'$/item':>9}{'s/item':>8}{'out tok':>9}")
    for r in rows:
        print(f"{r['model']:<18}{r['accuracy']:>6}%{str(tuple(r['ci95'])):>15}{r['n']:>5}{r['unscored']:>6}{r['cost_total']:>9}"
              f"{r['cost_per_item']:>9}{r['latency']:>8}{r['out_tokens']:>9}")


if __name__ == "__main__":
    main()
