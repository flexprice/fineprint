"""Retire published rows that were never really measured, and re-rank what's left.

``aggregate`` gates only on a model having at least ONE successful call, and the board ranks on
accuracy alone — so a model whose calls almost all failed (a provider outage, exhausted credits, a
dead endpoint) publishes the score of the handful that survived, sitting next to models measured
over the whole corpus. ``export.MIN_RELIABILITY`` now stops that at publish time; this repairs
boards written before the gate existed.

    python -m fineprint.repair_board                  # dry run against the live board
    python -m fineprint.repair_board --apply          # write it back (keeps a timestamped backup)
    python -m fineprint.repair_board --min 80         # stricter threshold

Reads/writes ``state/data.json`` in the GCS bucket when ``FINEPRINT_BUCKET`` is set, else the local
``WEB_DATA``. Retiring a row is not a verdict on the model — re-run it and it republishes on its
own merits (``fineprint.eval`` replaces a model's prior runs wholesale, so the failed ones go).
"""
import argparse
import json
import tempfile
import time
from pathlib import Path

from fineprint import store
from fineprint.config import WEB_DATA
from fineprint.export import MIN_RELIABILITY

BOARD_OBJ = "state/data.json"


def repair(board: dict, min_reliability: float) -> tuple[dict, list[dict]]:
    """Return (repaired board, retired rows). Pure — so the dry run shows exactly what --apply writes."""
    rows = board.get("rows", [])
    dropped = [r for r in rows if r.get("reliability", 100.0) < min_reliability]
    if not dropped:
        return board, []
    gone = {r["id"] for r in dropped}

    keep = [dict(r) for r in rows if r["id"] not in gone]
    keep.sort(key=lambda r: -r["accuracy"])
    for i, r in enumerate(keep, 1):
        r["rank"] = i

    out = {**board, "rows": keep, "n_models": len(keep)}
    # The homepage spotlights `newest_id`; it must not name a row that no longer exists. Fall back
    # the way build() picks it: the first `new` model by accuracy, else the top of the board.
    if board.get("newest_id") in gone:
        out["newest_id"] = next((r["id"] for r in keep if r.get("new")), keep[0]["id"] if keep else None)
    # The difficulty heatmap is keyed by model id — leave no ghost columns behind.
    contracts = board.get("contracts")
    if isinstance(contracts, dict) and isinstance(contracts.get("matrix"), dict):
        out["contracts"] = {**contracts,
                            "matrix": {k: v for k, v in contracts["matrix"].items() if k not in gone}}
    return out, dropped


def main() -> None:
    ap = argparse.ArgumentParser(description="Retire never-really-measured rows from the board.")
    ap.add_argument("--apply", action="store_true", help="write the repaired board back")
    ap.add_argument("--min", type=float, default=MIN_RELIABILITY, help="minimum reliability %%")
    ap.add_argument("--board", type=Path, default=WEB_DATA, help="local board path / download target")
    args = ap.parse_args()

    # Read the live board through a scratch file — a dry run must never touch the local board.
    src = args.board
    if store.enabled():
        src = Path(tempfile.gettempdir()) / "fineprint-board-live.json"
        store.download(BOARD_OBJ, src)
    board = json.loads(src.read_text())
    repaired, dropped = repair(board, args.min)

    where = f"gs://{store.BUCKET}/{BOARD_OBJ}" if store.enabled() else str(args.board)
    print(f"board: {where} — {len(board.get('rows', []))} models, threshold {args.min}% reliability\n")
    if not dropped:
        print("nothing to retire; every published row clears the threshold.")
        return
    for r in sorted(dropped, key=lambda r: r["rank"]):
        print(f"  RETIRE  rank #{r['rank']:<3} {r['id']:<28} accuracy={r['accuracy']:<6} "
              f"reliability={r.get('reliability')}%  calls={r.get('calls')}")
    print(f"\n  {len(repaired['rows'])} models remain; newest_id "
          f"{board.get('newest_id')!r} -> {repaired.get('newest_id')!r}")

    if not args.apply:
        print("\ndry run — re-run with --apply to write it back.")
        return

    if store.enabled():
        backup = f"{BOARD_OBJ}.bak-{time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())}"
        store.upload_json(backup, board)
        print(f"\nbacked up -> gs://{store.BUCKET}/{backup}")
        store.upload_json(BOARD_OBJ, repaired)
        print(f"wrote     -> gs://{store.BUCKET}/{BOARD_OBJ}")
    args.board.parent.mkdir(parents=True, exist_ok=True)
    args.board.write_text(json.dumps(repaired, indent=2))
    print(f"wrote     -> {args.board}")
    print("\nnext: redeploy the site so the repaired board goes live "
          "(Vercel deploy hook, or the 'Deploy web to Vercel' workflow).")


if __name__ == "__main__":
    main()
