import json
from types import SimpleNamespace

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

def test_extract_upload_unknown_model_rejected_before_ocr(monkeypatch):
    def _boom(*a, **k):
        raise AssertionError("extract_document (paid OCR) must not run for an unknown model")
    monkeypatch.setattr("pipeline.extractor.extract_document", _boom)
    r = client.post("/extract", data={"model": "not-a-real-model", "session_token": "a" * 32 + ".ok"},
                    files={"file": ("c.pdf", b"%PDF-1.4", "application/pdf")})
    assert r.status_code == 400
