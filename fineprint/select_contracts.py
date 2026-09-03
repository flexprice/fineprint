"""Pick the fixed corpus: which contracts earn a slot on the board.

Cost caps how many contracts every model can be run against, so slots have to earn their place. The
instinct is to keep the hardest ones, but difficulty and usefulness are different things: a
contract every model fails separates models exactly as poorly as one every model aces. Measured on
the old 22-contract set, the single hardest document (23.8% mean) spread models LESS than a
mid-difficulty one (49.6% mean) — correlation between difficulty and spread was only +0.29.

So we rank by spread of per-model accuracy. That skews hard anyway (easy documents saturate and
drop out first) while refusing to spend slots on documents nobody can do.

Scored from a cheap probe sweep — a handful of the least expensive models across the FULL corpus,
which costs a couple of dollars and is the only way to learn per-contract difficulty on the real
document set.

    python -m fineprint.select_contracts --keep 40            # preview
    python -m fineprint.select_contracts --keep 40 --write    # rewrite seed_contracts.json
"""
import argparse
import json
import statistics as st
from collections import defaultdict

from fineprint.config import RESULTS, SEED_CONTRACTS


def informativeness(runs: list[dict]) -> dict[str, float]:
    """contract -> spread (sd) of per-model accuracy. Higher separates models better.

    Only successful calls count: an errored call is missing data, not a zero. Counting failures as
    zeros would make any contract that happened to catch a provider outage look maximally
    discriminating — and it was exactly a provider outage that started all of this.
    """
    per: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    for r in runs:
        if r.get("ok") and r.get("scored"):
            per[r["contract"]][r["model"]].append(100.0 * r["correct"] / r["scored"])
    out = {}
    for contract, models in per.items():
        accs = [st.mean(v) for v in models.values()]
        out[contract] = st.pstdev(accs) if len(accs) > 1 else 0.0
    return out


def select(runs: list[dict], keep: int) -> list[str]:
    """The ``keep`` most informative contract names, most-informative first (ties broken by name so
    the same probe data always yields the same corpus)."""
    score = informativeness(runs)
    return sorted(score, key=lambda c: (-score[c], c))[:keep]


def main() -> None:
    ap = argparse.ArgumentParser(description="Choose the fixed contract corpus from probe runs.")
    ap.add_argument("--keep", type=int, default=40)
    ap.add_argument("--write", action="store_true", help="rewrite the seed contracts file")
    ap.add_argument("--runs", default=str(RESULTS), help="runs.json holding the probe sweep")
    ap.add_argument("--out", default=None, help="seed_contracts.json to write (default: alongside runs)")
    args = ap.parse_args()

    runs = json.loads(open(args.runs).read())["runs"]
    score = informativeness(runs)
    chosen = select(runs, args.keep)
    folder = {disp: f for disp, f in SEED_CONTRACTS}

    print(f"scored {len(score)} contracts from {len(runs)} probe runs; keeping {len(chosen)}\n")
    print(f"{'':>3} {'contract':<34}{'spread':>8}")
    for i, c in enumerate(chosen, 1):
        print(f"{i:>3} {c:<34}{score[c]:>8.1f}")
    dropped = sorted(set(score) - set(chosen), key=lambda c: -score[c])
    print(f"\ndropping {len(dropped)} (least separating): "
          + ", ".join(f"{c} ({score[c]:.1f})" for c in dropped[:6]) + (" …" if len(dropped) > 6 else ""))
    missing = [c for c in chosen if c not in folder]
    if missing:
        print(f"\nWARNING: no folder mapping for {missing} — not writing.")
        return
    if args.write:
        out = args.out or "seed_contracts.json"
        with open(out, "w") as fh:
            json.dump([[c, folder[c]] for c in chosen], fh, indent=1)
        print(f"\nwrote {out} — {len(chosen)} contracts. Upload it to the corpus bucket to make it "
              f"the fixed corpus for every future model.")
    else:
        print("\npreview only — pass --write to rewrite the seed contracts file.")


if __name__ == "__main__":
    main()
