"""Choosing which contracts survive into the fixed corpus.

Cost caps the corpus, so the slots have to earn their place. A contract every model aces and one
every model fails are equally useless for ranking — what separates models is spread. Selecting on
raw difficulty spends slots on floor cases (the hardest doc in the old set had LESS model spread
than a mid-difficulty one).
"""
from fineprint.select_contracts import informativeness, select


def _runs(table):
    """table: {contract: {model: accuracy_pct}} -> run records."""
    return [{"model": m, "contract": c, "ok": True, "correct": a, "scored": 100}
            for c, per in table.items() for m, a in per.items()]


def test_ranks_a_spread_contract_above_a_ceiling_one():
    r = _runs({"ceiling": {"a": 99, "b": 98, "c": 100},     # nobody is separated
               "spread":  {"a": 20, "b": 55, "c": 90}})     # cleanly separates all three
    score = informativeness(r)
    assert score["spread"] > score["ceiling"]


def test_ranks_a_spread_contract_above_a_floor_one():
    """The failure mode of picking 'toughest': everyone scoring ~0 tells you nothing."""
    r = _runs({"floor":  {"a": 2, "b": 0, "c": 3},
               "spread": {"a": 20, "b": 55, "c": 90}})
    score = informativeness(r)
    assert score["spread"] > score["floor"]


def test_select_keeps_the_k_most_informative():
    r = _runs({"ceiling": {"a": 99, "b": 98}, "floor": {"a": 1, "b": 2},
               "mid": {"a": 30, "b": 70}, "wide": {"a": 10, "b": 95}})
    assert set(select(r, keep=2)) == {"wide", "mid"}


def test_select_ignores_failed_calls_when_scoring_a_contract():
    """An errored call is missing data, not a zero — counting it as 0 would make any contract that
    happened to hit a provider outage look maximally discriminating."""
    r = _runs({"real": {"a": 40, "b": 60}})
    r.append({"model": "c", "contract": "real", "ok": False, "error": "APITimeoutError"})
    r += _runs({"other": {"a": 45, "b": 55}})
    assert select(r, keep=1) == ["real"]


def test_select_is_deterministic_for_the_same_input():
    r = _runs({"a1": {"m": 10, "n": 90}, "b2": {"m": 40, "n": 60}, "c3": {"m": 49, "n": 51}})
    assert select(r, keep=2) == select(r, keep=2)
