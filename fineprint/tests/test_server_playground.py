import json
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
