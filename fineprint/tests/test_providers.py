"""Unit tests for the provider call layer — attempt-gating by capability and reasoning defaults.

These are the fixes for the watch loop's "eval failed (exit 1) — all provider calls errored": a
model whose OpenRouter ``supported_parameters`` lacks ``structured_outputs`` must NOT waste (and, for
a slow reasoner, time out on) a doomed strict ``json_schema`` attempt-1, and a reasoning model with
no explicit effort must get a conservative default so it can't over-reason into the timeout.

No network: capabilities are passed on the model dict, and the OpenAI client is mocked.
"""
import json
import types
from unittest.mock import MagicMock

import pytest

from fineprint import providers as P


def _kinds(attempts):
    return [a["response_format"]["type"] if a.get("response_format") else "prompt" for a in attempts]


_BASE = {"model": "x", "messages": [{"role": "system", "content": "S"}]}


def test_plan_attempts_unknown_caps_tries_everything():
    assert _kinds(P._plan_attempts(_BASE, "U", None)) == ["json_schema", "json_object", "prompt"]


def test_plan_attempts_full_support_keeps_strict_first():
    caps = {"structured_outputs", "response_format"}
    assert _kinds(P._plan_attempts(_BASE, "U", caps)) == ["json_schema", "json_object", "prompt"]


def test_plan_attempts_no_structured_outputs_skips_strict():
    # The ox-alpha / deepseek-vision case: response_format but no structured_outputs.
    caps = {"response_format", "reasoning_effort"}
    assert _kinds(P._plan_attempts(_BASE, "U", caps)) == ["json_object", "prompt"]


def test_plan_attempts_no_response_format_is_prompt_only():
    assert _kinds(P._plan_attempts(_BASE, "U", set())) == ["prompt"]


def test_supported_params_reads_model_dict_without_network():
    m = {"provider": "openrouter", "openrouter_id": "x/y", "supported_parameters": ["response_format"]}
    assert P.supported_params(m) == {"response_format"}


def test_supported_params_unknown_when_non_openrouter():
    assert P.supported_params({"provider": "openai", "id": "gpt"}) is None


def _fake_resp():
    resp = MagicMock()
    resp.choices[0].message.content = json.dumps({
        "fields": [{"field": "currency", "value": "USD", "confidence": "HIGH",
                    "line_ids": [], "reasoning": "r", "doubt": None}],
        "open_items": [],
    })
    resp.usage.prompt_tokens = 1000
    resp.usage.completion_tokens = 200
    resp.usage.completion_tokens_details = types.SimpleNamespace(reasoning_tokens=50)
    return resp


@pytest.fixture
def mock_client(monkeypatch):
    calls = []

    def create(**kw):
        calls.append(kw)
        return _fake_resp()

    client = MagicMock()
    client.chat.completions.create.side_effect = create
    monkeypatch.setitem(P._CLIENTS, "openrouter", client)
    return calls


def test_call_skips_strict_and_sends_reasoner_controls(mock_client):
    # A resolved reasoner (fineprint.eval wires effort=low + a max_tokens cap) with no
    # structured_outputs must skip the doomed strict attempt and go straight to json_object.
    model = {"id": "ox-alpha", "openrouter_id": "stealth/ox-alpha", "provider": "openrouter",
             "supported_parameters": ["response_format", "reasoning_effort", "reasoning", "max_tokens"],
             "effort": "low", "max_tokens": P.REASONING_MAX_TOKENS, "price_in": 0.0, "price_out": 0.0}
    fields, usage, _ = P.call(model, "USER")
    assert len(mock_client) == 1                                   # no doomed strict attempt
    assert mock_client[0]["response_format"]["type"] == "json_object"
    assert mock_client[0]["reasoning_effort"] == "low"
    assert mock_client[0]["max_tokens"] == P.REASONING_MAX_TOKENS
    assert len(fields) == 1 and usage["in"] == 1000


def test_call_keeps_strict_for_structured_output_model(mock_client):
    model = {"id": "deepseek-v4-flash", "openrouter_id": "deepseek/deepseek-v4-flash",
             "provider": "openrouter",
             "supported_parameters": ["structured_outputs", "response_format", "reasoning_effort"],
             "effort": None, "price_in": 0.08, "price_out": 0.16}
    P.call(model, "USER")
    assert mock_client[0]["response_format"]["type"] == "json_schema"  # no regression for good models


def test_call_does_not_invent_reasoning_controls(mock_client):
    # call() must send ONLY what the model dict carries — no effort/max_tokens invented from caps.
    # Guards curated Claude/Gemini (effort=None by config) from silently gaining reasoning_effort.
    model = {"id": "claude", "openrouter_id": "anthropic/claude", "provider": "openrouter",
             "supported_parameters": ["structured_outputs", "response_format", "reasoning_effort"],
             "effort": None, "price_in": 5.0, "price_out": 25.0}
    P.call(model, "USER")
    assert "reasoning_effort" not in mock_client[0]
    assert "max_tokens" not in mock_client[0]


def test_call_drops_effort_from_model_lacking_the_param(mock_client):
    # A model whose caps lack reasoning_effort never receives it, even if the dict carries one.
    model = {"id": "noeffort", "openrouter_id": "lab/noeffort", "provider": "openrouter",
             "supported_parameters": ["structured_outputs", "response_format"],
             "effort": "low", "max_tokens": P.REASONING_MAX_TOKENS, "price_in": 1.0, "price_out": 1.0}
    P.call(model, "USER")
    assert "reasoning_effort" not in mock_client[0]
    assert "max_tokens" not in mock_client[0]


def test_call_falls_through_when_first_attempt_errors(mock_client):
    # A 400/param-rejection on attempt-1 must fall through to the next attempt, not raise.
    outcomes = [RuntimeError("400 bad response_format"), _fake_resp()]

    def create(**kw):
        mock_client.append(kw)
        r = outcomes.pop(0)
        if isinstance(r, Exception):
            raise r
        return r

    P._CLIENTS["openrouter"].chat.completions.create.side_effect = create
    model = {"id": "m", "openrouter_id": "lab/m", "provider": "openrouter",
             "supported_parameters": ["structured_outputs", "response_format"],
             "effort": None, "price_in": 1.0, "price_out": 1.0}
    fields, _, _ = P.call(model, "USER")
    assert len(fields) == 1                       # recovered on the second attempt
    assert len(mock_client) == 2
