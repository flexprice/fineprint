"""Resolve wiring + honest skip reasons.

Covers the second exit-1 failure mode the watch hit: a detected model id that isn't callable at eval
time (a withdrawn / renamed stealth variant like ``meta/muse-spark-1.2-contributor``). resolve() must
exit with a DISTINCT code so the watch reports "not on OpenRouter anymore" instead of the misleading
"all provider calls errored", and a resolved reasoner must be wired with its caps + a default effort.
"""
import io
import json

import pytest

from fineprint import eval as E
from fineprint import watch


def test_resolve_bad_spec_exits_unresolvable():
    # No slash, not a curated id -> unresolvable, before any network.
    with pytest.raises(SystemExit) as ei:
        E.resolve("not-a-real-id")
    assert ei.value.code == E.EXIT_UNRESOLVABLE


def test_resolve_missing_from_catalog_exits_unresolvable(monkeypatch):
    # The muse-spark-1.2-contributor case: a full slug that isn't in the live catalog.
    monkeypatch.setattr(E.urllib.request, "urlopen",
                        lambda url, timeout=40: io.StringIO(json.dumps({"data": []})))
    with pytest.raises(SystemExit) as ei:
        E.resolve("meta/muse-spark-1.2-contributor")
    assert ei.value.code == E.EXIT_UNRESOLVABLE


def test_resolve_wires_caps_and_effort_for_reasoner(monkeypatch):
    fake = {"data": [{
        "id": "lab/reasoner-x", "name": "Lab: Reasoner X",
        "pricing": {"prompt": "0", "completion": "0"},
        "supported_parameters": ["response_format", "reasoning_effort"],
    }]}
    monkeypatch.setattr(E.urllib.request, "urlopen",
                        lambda url, timeout=40: io.StringIO(json.dumps(fake)))
    captured = {}
    monkeypatch.setattr(E, "register_model", lambda m: captured.update(m))
    m = E.resolve("lab/reasoner-x")
    assert m["supported_parameters"] == ["response_format", "reasoning_effort"]
    assert m["effort"] == "low"                         # reasoner default effort
    assert m["max_tokens"] == E.REASONING_MAX_TOKENS    # runaway-reasoning safety cap
    assert m["price_in"] == 0.0 and m["price_out"] == 0.0   # free -> priced-check downstream => NA


def test_resolve_non_reasoner_gets_no_default_effort(monkeypatch):
    fake = {"data": [{
        "id": "lab/plain-x", "name": "Lab: Plain X",
        "pricing": {"prompt": "0.000001", "completion": "0.000002"},
        "supported_parameters": ["structured_outputs", "response_format"],
    }]}
    monkeypatch.setattr(E.urllib.request, "urlopen",
                        lambda url, timeout=40: io.StringIO(json.dumps(fake)))
    monkeypatch.setattr(E, "register_model", lambda m: None)
    m = E.resolve("lab/plain-x")
    assert m["effort"] is None
    assert m["max_tokens"] is None


def test_watch_maps_exit_codes_to_honest_reasons():
    assert "not on OpenRouter" in watch._EXIT_REASON[E.EXIT_UNRESOLVABLE]
    assert "provider call" in watch._EXIT_REASON[E.EXIT_ALL_FAILED]
    assert "privacy/data-policy" in watch._EXIT_REASON[E.EXIT_POLICY_BLOCKED]


def test_evaluate_exits_policy_blocked_when_every_call_hits_the_guardrail(monkeypatch):
    # The deepseek-v4-flash-vision-exp case: OpenRouter's own account-level privacy/data-policy
    # setting excludes every provider for this model — a 404 on every single call, verbatim message.
    model = {"id": "vision-exp", "label": "Vision Exp", "openrouter_id": "lab/vision-exp"}
    monkeypatch.setattr(E, "resolve", lambda spec: model)
    err = ("NotFoundError: Error code: 404 - {'error': {'message': 'No endpoints available matching "
           "your guardrail restrictions and data policy. Configure: https://openrouter.ai/set")
    monkeypatch.setattr(E, "run_models", lambda models, n_runs, workers, audit: [{"ok": False, "error": err}])
    monkeypatch.setattr(E, "merge_into_results", lambda records, n_runs: None)
    with pytest.raises(SystemExit) as ei:
        E.evaluate("lab/vision-exp", runs=1)
    assert ei.value.code == E.EXIT_POLICY_BLOCKED


def test_evaluate_exits_all_failed_for_ordinary_errors(monkeypatch):
    # A mixed-cause or non-guardrail failure still reports the generic (retriable) reason, not
    # POLICY_BLOCKED — only an all-guardrail failure set gets the account-settings message.
    model = {"id": "flaky", "label": "Flaky", "openrouter_id": "lab/flaky"}
    monkeypatch.setattr(E, "resolve", lambda spec: model)
    monkeypatch.setattr(E, "run_models",
                        lambda models, n_runs, workers, audit: [{"ok": False, "error": "TimeoutError: slow"}])
    monkeypatch.setattr(E, "merge_into_results", lambda records, n_runs: None)
    with pytest.raises(SystemExit) as ei:
        E.evaluate("lab/flaky", runs=1)
    assert ei.value.code == E.EXIT_ALL_FAILED
