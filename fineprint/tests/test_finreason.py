from fineprint.oss import finreason as F


def test_grading_is_numeric_and_strict():
    assert F.correct("1152", "work...\nANSWER: 1152")
    assert F.correct("1152", "ANSWER: 1,152.0")
    assert F.correct("22.35", "so\nANSWER: 22.349")            # rounds to the reference's precision
    assert F.correct("1000000", "ANSWER: 1001500")             # within 0.2%
    assert not F.correct("22", "ANSWER: 0.22")                 # a percentage given as a fraction is wrong
    assert not F.correct("1152", "ANSWER: 1160")
    assert not F.correct("1152", "I cannot tell")
    assert F.correct("True", "ANSWER: true") and not F.correct("False", "ANSWER: True") and not F.correct("True", "ANSWER: 1")
    assert F.correct("-3.5", "the change is 9\nANSWER: -3.5")


def test_sample_is_fixed_and_nested():
    a, b = F.items(20), F.items(60)
    assert [x["id"] for x in a] == [x["id"] for x in b[:20]] and len(F.items()) == 238


def test_cost_is_repriced_from_logged_tokens():
    recs = [{"model": "gpt-5.6-sol", "id": "a", "source": "x", "right": True, "cost": 99.0, "in": 1_000_000, "out": 100_000, "latency": 1.0}]
    assert F.summarize(recs)[0]["cost_total"] == 3.0            # 1M in at $2 + 0.1M out at $10, whatever was logged
