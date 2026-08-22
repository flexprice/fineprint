"""Publishing one model must never rewrite the models already on the board.

This is the regression guard for the incident where a single model's publish rebuilt the whole
board from runs.json and rescored every other model against a different contract set.
"""
import json

from fineprint import export


def _board(tmp_path, rows):
    p = tmp_path / "data.json"
    p.write_text(json.dumps({"rows": rows, "n_models": len(rows), "n_contracts": 22,
                             "n_runs": 3, "newest_id": rows[0]["id"] if rows else None}))
    return p


def test_add_model_leaves_existing_rows_untouched(tmp_path, monkeypatch):
    existing = [
        {"id": "alpha", "label": "Alpha", "accuracy": 90.0, "rank": 1, "cost_1k": 10.0},
        {"id": "beta", "label": "Beta", "accuracy": 50.0, "rank": 2, "cost_1k": 20.0},
    ]
    board_path = _board(tmp_path, [dict(r) for r in existing])
    monkeypatch.setattr(export, "WEB_DATA", board_path)
    monkeypatch.setattr(export, "all_models", lambda: [{"id": "gamma", "label": "Gamma"}])
    monkeypatch.setattr(export.pricing, "load", lambda: {})
    monkeypatch.setattr(export, "load_runs", lambda p: [{"model": "gamma"}])
    monkeypatch.setattr(export, "SEED_CONTRACTS", [("C1", "c1")])
    # aggregate is the only thing allowed to produce the NEW row
    monkeypatch.setattr(export, "aggregate",
                        lambda runs, models, contracts: ([{"id": "gamma", "label": "Gamma",
                                                           "accuracy": 70.0, "rank": 1}], {}))

    out = export.add_model("gamma")
    by_id = {r["id"]: r for r in out["rows"]}

    assert out["n_models"] == 3
    assert out["newest_id"] == "gamma"
    # the new row lands between them by accuracy
    assert [r["id"] for r in out["rows"]] == ["alpha", "gamma", "beta"]
    assert [r["rank"] for r in out["rows"]] == [1, 2, 3]
    # every pre-existing row survives byte-identical apart from its rank
    for old in existing:
        cur = dict(by_id[old["id"]]); was = dict(old)
        cur.pop("rank"); was.pop("rank")
        assert cur == was, f"existing row mutated: {old['id']}"


def test_add_model_replaces_its_own_row_on_rerun(tmp_path, monkeypatch):
    existing = [{"id": "alpha", "label": "Alpha", "accuracy": 90.0, "rank": 1},
                {"id": "gamma", "label": "Gamma", "accuracy": 10.0, "rank": 2}]
    board_path = _board(tmp_path, [dict(r) for r in existing])
    monkeypatch.setattr(export, "WEB_DATA", board_path)
    monkeypatch.setattr(export, "all_models", lambda: [{"id": "gamma", "label": "Gamma"}])
    monkeypatch.setattr(export.pricing, "load", lambda: {})
    monkeypatch.setattr(export, "load_runs", lambda p: [{"model": "gamma"}])
    monkeypatch.setattr(export, "SEED_CONTRACTS", [("C1", "c1")])
    monkeypatch.setattr(export, "aggregate",
                        lambda runs, models, contracts: ([{"id": "gamma", "accuracy": 95.0, "rank": 1}], {}))
    out = export.add_model("gamma")
    assert out["n_models"] == 2                      # re-published, not duplicated
    assert [r["id"] for r in out["rows"]] == ["gamma", "alpha"]


def test_add_model_returns_none_without_runs(tmp_path, monkeypatch):
    board_path = _board(tmp_path, [{"id": "alpha", "accuracy": 90.0, "rank": 1}])
    monkeypatch.setattr(export, "WEB_DATA", board_path)
    monkeypatch.setattr(export, "all_models", lambda: [{"id": "gamma"}])
    monkeypatch.setattr(export.pricing, "load", lambda: {})
    monkeypatch.setattr(export, "load_runs", lambda p: [])
    assert export.add_model("gamma") is None
    assert len(json.loads(board_path.read_text())["rows"]) == 1   # board untouched
