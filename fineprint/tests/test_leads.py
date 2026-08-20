import pytest
from fineprint.leads import valid_email, record_lead, valid_session_token

def test_valid_email_rejects_junk():
    assert valid_email("a@company.com")
    assert not valid_email("nope")
    assert not valid_email("a@")

def test_record_lead_notifies_and_returns_working_token():
    sent = {}
    tok = record_lead("dev@acme.com", "Acme", {"sample": "SaaS", "model": "GPT-5.5"},
                      notify_fn=lambda text: sent.setdefault("t", text),
                      store_append=lambda row: sent.setdefault("row", row))
    assert "acme.com" in sent["t"] and sent["row"]["company"] == "Acme"
    assert "file" not in sent["row"]                      # never store file contents
    assert valid_session_token(tok)

def test_record_lead_rejects_bad_email():
    with pytest.raises(ValueError):
        record_lead("nope", "Acme", {})
