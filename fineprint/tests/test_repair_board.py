"""Retiring never-really-measured rows from an already-published board.

The board ranks on accuracy alone and `aggregate` publishes any model with >=1 successful call, so
a provider outage (an OpenRouter 402 for exhausted credits failed 172 of 174 calls) can put the
score of two surviving documents at rank #30. `export.MIN_RELIABILITY` stops that at publish time;
this repairs boards written before the gate existed.
"""
from fineprint import repair_board


def _row(id, accuracy, reliability, **kw):
    return {"id": id, "accuracy": accuracy, "reliability": reliability, "calls": 174,
            "rank": kw.pop("rank", 1), **kw}


def test_retires_rows_below_the_threshold_and_reranks_the_rest():
    board = {"rows": [_row("alpha", 90.0, 100.0, rank=1),
                      _row("ghost", 72.4, 4.6, rank=2),
                      _row("beta", 70.0, 100.0, rank=3)],
             "n_models": 3, "newest_id": "alpha"}

    out, dropped = repair_board.repair(board, min_reliability=50.0)

    assert [r["id"] for r in dropped] == ["ghost"]
    assert [r["id"] for r in out["rows"]] == ["alpha", "beta"]
    assert [r["rank"] for r in out["rows"]] == [1, 2]
    assert out["n_models"] == 2


def test_leaves_a_healthy_board_untouched():
    board = {"rows": [_row("alpha", 90.0, 100.0, rank=1), _row("beta", 70.0, 87.4, rank=2)],
             "n_models": 2, "newest_id": "alpha"}
    out, dropped = repair_board.repair(board, min_reliability=50.0)
    assert dropped == []
    assert out == board


def test_moves_the_newest_spotlight_off_a_retired_row():
    """The homepage spotlights `newest_id`; it must not point at a row that no longer exists."""
    board = {"rows": [_row("alpha", 90.0, 100.0, rank=1, new=False),
                      _row("fresh", 80.0, 100.0, rank=2, new=True),
                      _row("ghost", 72.4, 1.1, rank=3, new=True)],
             "n_models": 3, "newest_id": "ghost"}

    out, _ = repair_board.repair(board, min_reliability=50.0)

    assert out["newest_id"] == "fresh"


def test_keeps_the_newest_spotlight_when_it_survives():
    board = {"rows": [_row("alpha", 90.0, 100.0, rank=1, new=True),
                      _row("ghost", 72.4, 1.1, rank=2, new=True)],
             "n_models": 2, "newest_id": "alpha"}
    out, _ = repair_board.repair(board, min_reliability=50.0)
    assert out["newest_id"] == "alpha"


def test_drops_retired_models_from_the_difficulty_heatmap():
    """The heatmap is keyed by model id — a retired row must not linger as a ghost column."""
    board = {"rows": [_row("alpha", 90.0, 100.0, rank=1), _row("ghost", 72.4, 1.1, rank=2)],
             "n_models": 2, "newest_id": "alpha",
             "contracts": {"labels": ["Doc A"], "difficulty": [80.0],
                           "matrix": {"alpha": [90.0], "ghost": [72.4]}}}

    out, _ = repair_board.repair(board, min_reliability=50.0)

    assert set(out["contracts"]["matrix"]) == {"alpha"}
    assert out["contracts"]["labels"] == ["Doc A"]


def test_does_not_mutate_the_board_it_was_given():
    """The dry run prints from the same function that --apply writes, so it must be pure."""
    board = {"rows": [_row("alpha", 90.0, 100.0, rank=1), _row("ghost", 72.4, 1.1, rank=2)],
             "n_models": 2, "newest_id": "ghost"}

    repair_board.repair(board, min_reliability=50.0)

    assert [r["id"] for r in board["rows"]] == ["alpha", "ghost"]
    assert board["n_models"] == 2 and board["newest_id"] == "ghost"
