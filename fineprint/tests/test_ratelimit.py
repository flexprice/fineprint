from fineprint.ratelimit import Limiter

def test_allows_up_to_limit_then_blocks_then_recovers():
    lim = Limiter(max_hits=2, window_s=60)
    assert lim.allow("ip1", now=1000.0)
    assert lim.allow("ip1", now=1001.0)
    assert not lim.allow("ip1", now=1002.0)          # 3rd within window blocked
    assert lim.allow("ip1", now=1062.0)              # window slid past first two
    assert lim.allow("ip2", now=1002.0)              # separate key unaffected
