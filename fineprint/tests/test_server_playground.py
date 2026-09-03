import json
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
import fineprint.server as srv

client = TestClient(srv.app)

def test_lead_then_token_unlocks(monkeypatch):
    monkeypatch.setattr(srv.leads, "record_lead", lambda **k: "x" * 32 + ".ok")
    r = client.post("/lead", json={"email": "d@acme.com", "company": "Acme", "context": {}})
    assert r.status_code == 200 and r.json()["session_token"].endswith(".ok")

def test_extract_sample_returns_pages_and_fields(monkeypatch, tmp_path):
    # a fake precomputed sample: pages + a cached default extraction
    sample = {"pages": [{"image": "data:image/png;base64,AAAA", "w": 800, "h": 1000}],
              "fields": [{"field": "recurring_fee.amount", "value": "10000", "confidence": "HIGH",
                          "category": "Recurring Fee", "boxes": [{"page": 0, "box": [0.1, 0.1, 0.3, 0.12]}]}],
              "model": "GPT-5.5", "latency": 1.2}
    monkeypatch.setattr(srv, "_load_sample_result", lambda sid, model: sample)
    r = client.post("/extract", json={"sample_id": "guidewire", "model": "gpt-5.5"})
    assert r.status_code == 200
    body = r.json()
    assert body["pages"][0]["w"] == 800 and body["fields"][0]["field"] == "recurring_fee.amount"

def test_extract_upload_requires_valid_token(monkeypatch):
    r = client.post("/extract", data={"model": "gpt-5.5", "session_token": "bad"},
                    files={"file": ("c.pdf", b"%PDF-1.4", "application/pdf")})
    assert r.status_code == 401

def test_client_id_uses_rightmost_xff_entry_not_attacker_controlled_leftmost():
    # Leftmost XFF entries are client-supplied and spoofable (a caller could send a random one
    # per request to dodge the rate-limit bucket); only the rightmost, trusted-hop-appended
    # entry may be used as the rate-limit key.
    req = SimpleNamespace(headers={"x-forwarded-for": "attacker-spoofed-1, 10.0.0.1, 203.0.113.9"},
                          client=SimpleNamespace(host="unused"))
    assert srv._client_id(req) == "203.0.113.9"

def test_client_id_falls_back_to_client_host_without_xff():
    req = SimpleNamespace(headers={}, client=SimpleNamespace(host="127.0.0.1"))
    assert srv._client_id(req) == "127.0.0.1"

def test_extract_sample_id_traversal_rejected_before_pickle(monkeypatch):
    def _boom(*a, **k):
        raise AssertionError("pickle.loads must not be reached for an unknown/traversal sample_id")
    monkeypatch.setattr("pickle.loads", _boom)
    r = client.post("/extract", json={"sample_id": "../secret", "model": "gpt-5.5"})
    assert r.status_code == 404

def test_extract_sample_missing_sample_id_is_422():
    r = client.post("/extract", json={"model": "gpt-5.5"})
    assert r.status_code == 422

def test_load_sample_result_unprepped_sample_is_503_not_500(monkeypatch, tmp_path):
    # "guidewire" is a real id in the public sample catalog (playground-samples.json), but
    # SAMPLE_DIR here has nothing prepped for it (no meta.json/doc.pkl/pages.json) — this must
    # surface as a clean 503, not an unhandled FileNotFoundError -> 500.
    monkeypatch.setattr(srv, "SAMPLE_DIR", tmp_path)
    with pytest.raises(HTTPException) as exc_info:
        srv._load_sample_result("guidewire", "gpt-5.5")
    assert exc_info.value.status_code == 503

def test_extract_sample_unprepped_returns_503_over_http(monkeypatch, tmp_path):
    monkeypatch.setattr(srv, "SAMPLE_DIR", tmp_path)
    r = client.post("/extract", json={"sample_id": "guidewire", "model": "gpt-5.5"})
    assert r.status_code == 503

def test_extract_upload_unknown_model_rejected_before_ocr(monkeypatch):
    def _boom(*a, **k):
        raise AssertionError("extract_document (paid OCR) must not run for an unknown model")
    monkeypatch.setattr("pipeline.extractor.extract_document", _boom)
    valid_token = srv.leads.issue_session_token("d@acme.com")   # must be a *real* token to get past the gate
    r = client.post("/extract", data={"model": "not-a-real-model", "session_token": valid_token},
                    files={"file": ("c.pdf", b"%PDF-1.4", "application/pdf")})
    assert r.status_code == 400

def test_lead_rate_limited_after_repeated_calls(monkeypatch):
    # isolate this test's rate-limit budget from every other test sharing the module-level
    # limiter and TestClient identity, so ordering/other tests' /lead|/extract calls can't
    # affect this assertion (and vice versa).
    monkeypatch.setattr(srv, "_limiter", srv.Limiter(max_hits=2, window_s=60))
    monkeypatch.setattr(srv.leads, "record_lead", lambda **k: "tok")
    body = {"email": "d@acme.com", "company": "Acme", "context": {}}
    assert client.post("/lead", json=body).status_code == 200
    assert client.post("/lead", json=body).status_code == 200
    r = client.post("/lead", json=body)
    assert r.status_code == 429


# A crash must still be READABLE by the browser. Starlette's stack is
# ServerErrorMiddleware -> CORSMiddleware -> router, so an uncaught exception is turned into a 500
# by the OUTERMOST middleware and never passes back through the CORS wrapper. The response then
# has no access-control-allow-origin, the browser blocks it, and fetch() rejects with
# "Failed to fetch" — the real status and message are invisible to the client. That is how an
# OpenRouter 402 (insufficient credits) surfaced on the live site as a bare network error.
_ORIGIN = "https://fineprint.flexprice.io"
_noraise = TestClient(srv.app, raise_server_exceptions=False)


def test_unhandled_exception_returns_500_with_cors_headers(monkeypatch):
    def boom(sid, model):
        raise RuntimeError("Error code: 402 - Insufficient credits")
    monkeypatch.setattr(srv, "_load_sample_result", boom)

    r = _noraise.post("/extract", json={"sample_id": "guidewire", "model": "gpt-5.5"},
                      headers={"Origin": _ORIGIN})

    assert r.status_code == 500
    assert r.headers.get("access-control-allow-origin") == _ORIGIN


def test_unhandled_exception_body_is_json_with_a_detail(monkeypatch):
    """The client reads `detail` off the error body (web/lib/playground-api.ts), so a crash has to
    answer in the same shape as a handled HTTPException or it renders as a generic failure."""
    def boom(sid, model):
        raise RuntimeError("kaboom")
    monkeypatch.setattr(srv, "_load_sample_result", boom)

    r = _noraise.post("/extract", json={"sample_id": "guidewire", "model": "gpt-5.5"},
                      headers={"Origin": _ORIGIN})

    assert r.json()["detail"]


def test_handled_http_exception_still_carries_cors_headers():
    r = _noraise.post("/extract", data={"model": "gpt-5.5", "session_token": "bad"},
                      files={"file": ("c.pdf", b"%PDF-1.4", "application/pdf")},
                      headers={"Origin": _ORIGIN})
    assert r.status_code == 401
    assert r.headers.get("access-control-allow-origin") == _ORIGIN


def test_upload_flow_has_a_tighter_per_ip_cap_than_the_general_limiter(monkeypatch):
    """Each upload costs real Datalab OCR + a model call, so it needs a far tighter budget than
    the shared 12/min: one IP could otherwise drive hundreds of paid runs an hour. The cap is
    checked AFTER the token gate (a bad token shouldn't burn quota) and BEFORE any OCR spend."""
    from fineprint import leads
    from fineprint.ratelimit import Limiter

    monkeypatch.setattr(srv, "_limiter", Limiter(max_hits=100, window_s=60))
    monkeypatch.setattr(srv, "_upload_limiter", Limiter(max_hits=2, window_s=3600))
    monkeypatch.setattr(srv, "_resolve_model", lambda m: {"id": "gpt-5.5", "label": "GPT-5.5"})
    spent = []
    monkeypatch.setattr(srv, "_extract_upload",
                        lambda pdf, m: spent.append(1) or {"fields": [], "pages": [],
                                                           "model": "GPT-5.5", "latency": 0.1})
    tok = leads.issue_session_token("dev@acme.com")

    def upload():
        return client.post("/extract", data={"model": "gpt-5.5", "session_token": tok},
                           files={"file": ("c.pdf", b"%PDF-1.4 tiny", "application/pdf")})

    assert upload().status_code == 200
    assert upload().status_code == 200
    third = upload()

    assert third.status_code == 429
    assert len(spent) == 2, "the throttled upload must not reach the paid OCR path"


def test_upload_cap_is_not_consumed_by_a_rejected_token(monkeypatch):
    from fineprint.ratelimit import Limiter
    monkeypatch.setattr(srv, "_limiter", Limiter(max_hits=100, window_s=60))
    monkeypatch.setattr(srv, "_upload_limiter", Limiter(max_hits=1, window_s=3600))
    monkeypatch.setattr(srv, "_resolve_model", lambda m: {"id": "gpt-5.5", "label": "GPT-5.5"})
    monkeypatch.setattr(srv, "_extract_upload", lambda pdf, m: {"fields": [], "pages": [],
                                                               "model": "GPT-5.5", "latency": 0.1})
    bad = client.post("/extract", data={"model": "gpt-5.5", "session_token": "forged"},
                      files={"file": ("c.pdf", b"%PDF-1.4", "application/pdf")})
    assert bad.status_code == 401

    from fineprint import leads
    ok = client.post("/extract", data={"model": "gpt-5.5",
                                       "session_token": leads.issue_session_token("d@acme.com")},
                     files={"file": ("c.pdf", b"%PDF-1.4", "application/pdf")})
    assert ok.status_code == 200, "the 401 must not have eaten the single upload slot"
