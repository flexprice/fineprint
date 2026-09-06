"""Task ordering for the sweep, and the guard that keeps direct routing a one-time thing.

Latency is a published column, so it has to be measured under conditions we control. Firing many
concurrent calls at the SAME endpoint inflates it (a 30-worker sweep reported gpt-5.5 at ~181s
against its true ~74s p50) — so the worker pool must spread its in-flight calls across DIFFERENT
models, which means interleaving the task list rather than running model-major.
"""
from fineprint import run as R


def _models(n):
    return [{"id": f"m{i}", "brand": "openai", "openrouter_id": f"openai/m{i}"} for i in range(n)]


def test_task_order_interleaves_models_so_no_endpoint_is_hammered():
    models, contracts = _models(5), [(f"C{i}", f"c{i}") for i in range(4)]

    order = R._task_order(models, contracts, n_runs=1)

    assert len(order) == 20
    # any window the size of the model count must hit that many distinct endpoints
    first = [m["id"] for m, _ in order[:5]]
    assert len(set(first)) == 5, f"first 5 tasks hit {set(first)} — same-model concurrency"


def test_task_order_covers_every_model_contract_run_exactly_once():
    models, contracts = _models(3), [(f"C{i}", f"c{i}") for i in range(4)]
    order = R._task_order(models, contracts, n_runs=2)
    assert len(order) == 3 * 4 * 2
    seen = {}
    for m, disp in order:
        seen[(m["id"], disp)] = seen.get((m["id"], disp), 0) + 1
    assert set(seen.values()) == {2}


def test_sweep_calls_the_provider_without_direct_routing_by_default(monkeypatch):
    """The default path — the one the watch loop takes for every newly-shipped model — must never
    bill a lab directly, or new models stop being comparable to the re-baselined board."""
    seen = {}
    def fake_call(model, user, direct=False):
        seen["direct"] = direct
        return [], {"in": 1, "out": 1, "reasoning": 0}, 0.1
    monkeypatch.setattr(R, "call", fake_call)
    monkeypatch.setattr(R, "score", lambda f, t: {"correct": 0, "scored": 0, "high": 0,
                                                  "confident_wrong": 0})
    R._run_one(_models(1)[0], "C0", "prompt", truth={})
    assert seen["direct"] is False


def test_sweep_can_cap_max_tokens_on_every_model(monkeypatch):
    """OpenRouter reserves each in-flight request against the model's max output. Models that send
    no max_tokens reserve their whole window, so a few dozen concurrent calls can exceed the
    account balance and 402 — 'would exceed your available credits given your current in-flight
    requests'. Capping bounds the reservation without truncating this schema (~5-7k tokens)."""
    from fineprint.sweep import apply_max_tokens
    models = [{"id": "a"}, {"id": "b", "max_tokens": 2000}]

    apply_max_tokens(models, 16000)

    assert models[0]["max_tokens"] == 16000
    assert models[1]["max_tokens"] == 2000, "an explicit per-model cap must win"


def test_run_models_checkpoints_partial_results(monkeypatch):
    """A multi-hour sweep that only writes at the end loses everything to one crash or cancel.
    Checkpointing hands the caller the results so far, periodically, mid-run."""
    monkeypatch.setattr(R, "_prep", lambda: ({f"C{i}": "p" for i in range(4)},
                                             {f"C{i}": {} for i in range(4)}))
    monkeypatch.setattr(R, "SEED_CONTRACTS", [(f"C{i}", f"c{i}") for i in range(4)])
    monkeypatch.setattr(R, "_run_one",
                        lambda m, disp, u, t, audit=False, direct=False: {
                            "model": m["id"], "contract": disp, "ok": True,
                            "correct": 1, "scored": 1, "latency": 0.1})
    seen = []
    R.run_models(_models(2), n_runs=1, workers=2, log=lambda *a: None,
                 checkpoint=lambda recs: seen.append(len(recs)), checkpoint_every=3)

    assert seen, "checkpoint was never invoked"
    assert seen[-1] <= 8 and max(seen) >= 3, f"unexpected checkpoint sizes: {seen}"


def test_run_models_skips_already_completed_pairs(monkeypatch):
    """Resume: a (model, contract) already recorded must not be paid for twice."""
    monkeypatch.setattr(R, "_prep", lambda: ({f"C{i}": "p" for i in range(3)},
                                             {f"C{i}": {} for i in range(3)}))
    monkeypatch.setattr(R, "SEED_CONTRACTS", [(f"C{i}", f"c{i}") for i in range(3)])
    called = []
    monkeypatch.setattr(R, "_run_one",
                        lambda m, disp, u, t, audit=False, direct=False: called.append((m["id"], disp))
                        or {"model": m["id"], "contract": disp, "ok": True,
                            "correct": 1, "scored": 1, "latency": 0.1})

    R.run_models(_models(2), n_runs=1, workers=2, log=lambda *a: None,
                 done={("m0", "C0"), ("m1", "C2")})

    assert ("m0", "C0") not in called and ("m1", "C2") not in called
    assert len(called) == 4, f"expected 6-2=4 calls, got {len(called)}"
