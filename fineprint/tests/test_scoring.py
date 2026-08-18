"""Unit tests for field-level scoring: exact match, hallucination, economic equivalence.

The scorer always scores a few fields with non-null defaults (e.g. ``commitment.true_up`` -> "no"),
so tests measure the *contribution* of the field under test against an empty-prediction baseline.
"""
from pipeline import evaluate as ev
from pipeline.reasoner import FieldEnvelope
from fineprint.scoring import score


def _fe(field, value, conf="HIGH"):
    return FieldEnvelope(field=field, value=value, confidence=conf, line_ids=[])


def _truth(d):
    return {f: ev._norm(f, d.get(f)) for f in ev.COL.values()}


def _delta(fields, truth):
    """How much the given predictions change the scorecard vs predicting nothing."""
    base = score([], truth)
    got = score(fields, truth)
    return {k: got[k] - base[k] for k in got}


def test_exact_match_counts_correct():
    # A field is scored because truth has it; the prediction flips it to correct.
    d = _delta([_fe("recurring_fee.amount", "10000")], _truth({"recurring_fee.amount": "10000"}))
    assert d["correct"] == 1 and d["confident_wrong"] == 0


def test_high_confidence_wrong_is_a_hallucination():
    # Hallucination is tracked on scalar extraction facts (fee amounts route through the fee bag).
    d = _delta([_fe("commitment.amount", "99999", "HIGH")], _truth({"commitment.amount": "10000"}))
    assert d["correct"] == 0 and d["high"] == 1 and d["confident_wrong"] == 1


def test_needs_review_wrong_is_not_a_hallucination():
    d = _delta([_fe("commitment.amount", "99999", "NEEDS_REVIEW")], _truth({"commitment.amount": "10000"}))
    assert d["confident_wrong"] == 0 and d["high"] == 0


def test_economic_equivalence_quarterly_equals_annual():
    # truth: $40k annual; prediction: $10k quarterly -> annualized equal -> the fee matches in the bag.
    # v2 scores the fee as ONE unit (matched by annualized value), not amount + frequency separately.
    truth = _truth({"recurring_fee.amount": "40000", "recurring_fee.frequency": "Annual"})
    d = _delta([_fe("recurring_fee.amount", "10000"), _fe("recurring_fee.frequency", "Quarterly")], truth)
    assert d["correct"] == 1                        # one fee, matched via annualized equivalence
