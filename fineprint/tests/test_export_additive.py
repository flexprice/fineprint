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


def test_add_model_refuses_a_row_whose_calls_mostly_failed(tmp_path, monkeypatch):
    """A model that errored on almost every call must not reach the board.

    Regression guard for the incident where an OpenRouter 402 (insufficient credits) failed 172 of
    174 calls, and the surviving 2 were published as a real score at rank #30 — accuracy computed
    from two documents, ranked against everyone else's 22-document average.
    """
    board_path = _board(tmp_path, [{"id": "alpha", "accuracy": 90.0, "rank": 1}])
    monkeypatch.setattr(export, "WEB_DATA", board_path)
    monkeypatch.setattr(export, "all_models", lambda: [{"id": "gamma", "label": "Gamma"}])
    monkeypatch.setattr(export.pricing, "load", lambda: {})
    monkeypatch.setattr(export, "load_runs", lambda p: [{"model": "gamma"}])
    monkeypatch.setattr(export, "SEED_CONTRACTS", [("C1", "c1")])
    monkeypatch.setattr(export, "aggregate",
                        lambda runs, models, contracts: ([{"id": "gamma", "accuracy": 61.5,
                                                           "reliability": 1.1, "calls": 174}], {}))

    assert export.add_model("gamma") is None
    assert [r["id"] for r in json.loads(board_path.read_text())["rows"]] == ["alpha"]


def test_add_model_publishes_a_row_with_healthy_reliability(tmp_path, monkeypatch):
    board_path = _board(tmp_path, [{"id": "alpha", "accuracy": 90.0, "rank": 1}])
    monkeypatch.setattr(export, "WEB_DATA", board_path)
    monkeypatch.setattr(export, "all_models", lambda: [{"id": "gamma", "label": "Gamma"}])
    monkeypatch.setattr(export.pricing, "load", lambda: {})
    monkeypatch.setattr(export, "load_runs", lambda p: [{"model": "gamma"}])
    monkeypatch.setattr(export, "SEED_CONTRACTS", [("C1", "c1")])
    monkeypatch.setattr(export, "aggregate",
                        lambda runs, models, contracts: ([{"id": "gamma", "accuracy": 61.5,
                                                           "reliability": 98.3, "calls": 174}], {}))

    out = export.add_model("gamma")
    assert out is not None
    assert [r["id"] for r in out["rows"]] == ["alpha", "gamma"]


# ── the corpus is what the board declares, not whatever runs.json happens to hold ────────────
def _runs_for(model, contracts, correct=8, scored=10):
    return [{"model": model, "contract": c, "ok": True, "correct": correct, "scored": scored,
             "high": 0, "confident_wrong": 0, "latency": 1.0, "in": 10, "out": 10, "reasoning": 0}
            for c in contracts]


def test_build_scores_every_model_on_the_declared_corpus_only(tmp_path, monkeypatch):
    """A probe model swept over the full document set must be aggregated over the SAME contracts
    as everyone else — otherwise the board silently compares different test sets again."""
    corpus = [("C1", "c1"), ("C2", "c2")]
    runs = _runs_for("wide", ["C1", "C2", "C3_not_in_corpus"], correct=10) + \
           _runs_for("narrow", ["C1", "C2"], correct=5)
    results = tmp_path / "runs.json"
    results.write_text(json.dumps({"n_runs": 1, "runs": runs}))
    monkeypatch.setattr(export, "RESULTS", results)
    monkeypatch.setattr(export, "WEB_DATA", tmp_path / "data.json")
    monkeypatch.setattr(export, "SEED_CONTRACTS", corpus)
    monkeypatch.setattr(export, "all_models", lambda: [
        {"id": "wide", "label": "W", "family": "F", "price_in": 1, "price_out": 1},
        {"id": "narrow", "label": "N", "family": "F", "price_in": 1, "price_out": 1}])
    monkeypatch.setattr(export.pricing, "load", lambda: {})

    data = export.build()
    wide = next(r for r in data["rows"] if r["id"] == "wide")

    assert wide["calls"] == 2, "the out-of-corpus contract leaked into the aggregate"
    assert data["n_contracts"] == 2


def test_build_drops_a_model_that_covers_too_little_of_the_corpus(tmp_path, monkeypatch):
    """Reliability catches calls that FAILED; it cannot catch a model that was never run on most
    of the corpus (6 stale contracts out of 40 all succeed = 100% reliable, and meaningless)."""
    corpus = [(f"C{i}", f"c{i}") for i in range(10)]
    runs = _runs_for("full", [c for c, _ in corpus]) + _runs_for("stale", ["C0", "C1"])
    results = tmp_path / "runs.json"
    results.write_text(json.dumps({"n_runs": 1, "runs": runs}))
    monkeypatch.setattr(export, "RESULTS", results)
    monkeypatch.setattr(export, "WEB_DATA", tmp_path / "data.json")
    monkeypatch.setattr(export, "SEED_CONTRACTS", corpus)
    monkeypatch.setattr(export, "all_models", lambda: [
        {"id": "full", "label": "F", "family": "F", "price_in": 1, "price_out": 1},
        {"id": "stale", "label": "S", "family": "F", "price_in": 1, "price_out": 1}])
    monkeypatch.setattr(export.pricing, "load", lambda: {})

    ids = [r["id"] for r in export.build()["rows"]]

    assert ids == ["full"], "a model covering 2 of 10 contracts must not be published"


def test_build_counts_coverage_from_successful_calls_only(tmp_path, monkeypatch):
    """A model that ATTEMPTED all 40 contracts but succeeded on 2 is not 100% covered — it is
    unmeasured. Counting attempts let a 5%-reliability row publish at rank #7."""
    corpus = [(f"C{i}", f"c{i}") for i in range(10)]
    runs = _runs_for("solid", [c for c, _ in corpus])
    for i in range(10):                      # attempted everything, succeeded twice
        runs.append({"model": "ghost", "contract": f"C{i}", "ok": i < 2, "correct": 8, "scored": 10,
                     "high": 0, "confident_wrong": 0, "latency": 1.0, "in": 10, "out": 10,
                     "reasoning": 0})
    results = tmp_path / "runs.json"
    results.write_text(json.dumps({"n_runs": 1, "runs": runs}))
    monkeypatch.setattr(export, "RESULTS", results)
    monkeypatch.setattr(export, "WEB_DATA", tmp_path / "data.json")
    monkeypatch.setattr(export, "SEED_CONTRACTS", corpus)
    monkeypatch.setattr(export, "all_models", lambda: [
        {"id": "solid", "label": "S", "family": "F", "price_in": 1, "price_out": 1},
        {"id": "ghost", "label": "G", "family": "F", "price_in": 1, "price_out": 1}])
    monkeypatch.setattr(export.pricing, "load", lambda: {})

    assert [r["id"] for r in export.build()["rows"]] == ["solid"]


def test_build_drops_a_model_whose_calls_mostly_failed(tmp_path, monkeypatch):
    """MIN_RELIABILITY guarded add_model but never build(), so a full rebuild republished exactly
    the rows the gate exists to stop."""
    corpus = [(f"C{i}", f"c{i}") for i in range(10)]
    runs = _runs_for("solid", [c for c, _ in corpus])
    for i in range(10):                      # covered everywhere, but half its retries failed
        runs.append({"model": "flaky", "contract": f"C{i}", "ok": True, "correct": 8, "scored": 10,
                     "high": 0, "confident_wrong": 0, "latency": 1.0, "in": 10, "out": 10,
                     "reasoning": 0})
        runs += [{"model": "flaky", "contract": f"C{i}", "ok": False, "error": "x"} for _ in range(4)]
    results = tmp_path / "runs.json"
    results.write_text(json.dumps({"n_runs": 1, "runs": runs}))
    monkeypatch.setattr(export, "RESULTS", results)
    monkeypatch.setattr(export, "WEB_DATA", tmp_path / "data.json")
    monkeypatch.setattr(export, "SEED_CONTRACTS", corpus)
    monkeypatch.setattr(export, "all_models", lambda: [
        {"id": "solid", "label": "S", "family": "F", "price_in": 1, "price_out": 1},
        {"id": "flaky", "label": "K", "family": "F", "price_in": 1, "price_out": 1}])
    monkeypatch.setattr(export.pricing, "load", lambda: {})

    assert [r["id"] for r in export.build()["rows"]] == ["solid"]
