"""Unit tests for the pure aggregation logic (no I/O, no model calls)."""
from fineprint.aggregate import aggregate, pct, _percentile


def _run(model, contract="C", ok=True, **kw):
    return {"model": model, "contract": contract, "ok": ok, **kw}


def _metrics(correct, scored, high=0, cw=0, lat=1.0, tin=100, tout=100, reasoning=0):
    return dict(correct=correct, scored=scored, high=high, confident_wrong=cw,
                latency=lat, reasoning=reasoning, **{"in": tin, "out": tout})


MODEL = {"id": "m1", "label": "M1", "family": "F", "provider": "openai",
         "price_in": 1.0, "price_out": 2.0}


def test_pct():
    assert pct(3, 4) == 75.0
    assert pct(0, 0) == 0.0            # guards divide-by-zero


def test_percentile():
    assert _percentile([1, 2, 3, 4, 5], 0.5) == 3
    assert _percentile([], 0.5) == 0.0


def test_aggregate_basic_metrics():
    runs = [_run("m1", **_metrics(8, 10, high=6, cw=1, lat=2.0, tin=1000, tout=500)),
            _run("m1", **_metrics(9, 10, high=6, cw=0, lat=3.0, tin=1000, tout=500))]
    rows, stats = aggregate(runs, [MODEL], [("C", "C")])
    r = rows[0]
    assert r["accuracy"] == 85.0                    # (8+9)/20
    assert r["halluc"] == pct(1, 12)                # confident_wrong / high across runs
    assert r["cost_1k"] == 2.0                      # (1000*1 + 500*2)/1e6*1000
    assert r["reliability"] == 100.0
    assert r["rank"] == 1
    assert stats["total_judgments"] == 20


def test_aggregate_ranks_by_accuracy_desc():
    lo = {**MODEL, "id": "lo", "label": "lo"}
    hi = {**MODEL, "id": "hi", "label": "hi"}
    runs = [_run("lo", **_metrics(5, 10)), _run("hi", **_metrics(9, 10))]
    rows, _ = aggregate(runs, [lo, hi], [("C", "C")])
    assert [r["id"] for r in rows] == ["hi", "lo"]
    assert [r["rank"] for r in rows] == [1, 2]


def test_aggregate_reliability_counts_failures():
    runs = [_run("m1", **_metrics(9, 10)), _run("m1", ok=False, error="boom")]
    rows, _ = aggregate(runs, [MODEL], [("C", "C")])
    assert rows[0]["reliability"] == 50.0           # 1 ok of 2 calls


def test_aggregate_excludes_model_with_no_successful_runs():
    runs = [_run("m1", ok=False, error="boom")]
    rows, stats = aggregate(runs, [MODEL], [("C", "C")])
    assert rows == []
    assert stats["total_judgments"] == 0


def test_aggregate_output_has_no_contract_identities():
    # Publishable rows must never leak contract names.
    runs = [_run("m1", contract="SecretCorp", **_metrics(9, 10))]
    rows, _ = aggregate(runs, [MODEL], [("SecretCorp", "SecretCorp")])
    blob = repr(rows)
    assert "SecretCorp" not in blob


def test_aggregate_free_model_cost_and_value_are_na_not_zero():
    # A free/stealth model lists $0 prompt+completion — that's an UNKNOWN price, not "free forever".
    # cost + value must publish as None (NA), never $0 / value 0 (which would misrank it).
    free = {**MODEL, "id": "free", "label": "free", "price_in": 0.0, "price_out": 0.0}
    runs = [_run("free", **_metrics(9, 10, tin=1000, tout=500))]
    rows, _ = aggregate(runs, [free], [("C", "C")])
    r = rows[0]
    assert r["cost_1k"] is None
    assert r["cost_contract"] is None
    assert r["value"] is None
    assert r["accuracy"] == 90.0          # everything else still scores normally


def test_aggregate_priced_model_keeps_numeric_cost_and_value():
    runs = [_run("m1", **_metrics(9, 10, tin=1000, tout=500))]
    rows, _ = aggregate(runs, [MODEL], [("C", "C")])
    r = rows[0]
    assert r["cost_1k"] == 2.0
    assert r["value"] == round(90.0 / 2.0, 2)
    assert r["cost_contract"] == round(2.0 / 1000, 4)


def test_aggregate_partial_price_is_priced_not_na():
    # price_out set, price_in zero -> still a priced model (not free/stealth).
    half = {**MODEL, "id": "half", "label": "half", "price_in": 0.0, "price_out": 2.0}
    runs = [_run("half", **_metrics(9, 10, tin=1000, tout=500))]
    rows, _ = aggregate(runs, [half], [("C", "C")])
    r = rows[0]
    assert r["cost_1k"] is not None and r["value"] is not None
