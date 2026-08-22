import pytest
from fineprint.leads import (
    valid_email, record_lead, valid_session_token, issue_session_token,
)

def test_valid_email_rejects_junk():
    assert valid_email("a@company.com")
    assert not valid_email("nope")
    assert not valid_email("a@")

def test_record_lead_notifies_and_returns_working_token():
    sent = {}
    tok = record_lead("dev@acme.com", "Ada Lovelace", {"sample": "SaaS", "model": "GPT-5.5"},
                      notify_fn=lambda text: sent.setdefault("t", text),
                      store_append=lambda row: sent.setdefault("row", row))
    assert "acme.com" in sent["t"] and sent["row"]["name"] == "Ada Lovelace"
    assert "file" not in sent["row"]                      # never store file contents
    assert valid_session_token(tok)

def test_record_lead_rejects_bad_email():
    with pytest.raises(ValueError):
        record_lead("nope", "Ada Lovelace", {})

def test_record_lead_rejects_missing_name():
    with pytest.raises(ValueError):
        record_lead("dev@acme.com", "  ", {})

def test_issue_session_token_is_self_verifying_and_carries_the_email():
    tok = issue_session_token("dev@acme.com")
    assert tok.count(".") == 1
    assert valid_session_token(tok)

def test_valid_session_token_rejects_forged_token():
    # The old scheme only checked shape (32 hex chars + ".ok"); a forged token of that shape
    # must now be rejected since the HMAC is never actually verified against it.
    forged = "a" * 32 + ".ok"
    assert not valid_session_token(forged)

def test_valid_session_token_rejects_tampered_email():
    tok = issue_session_token("dev@acme.com")
    b64, _, sig = tok.rpartition(".")
    other_tok = issue_session_token("attacker@evil.com")
    other_b64 = other_tok.rpartition(".")[0]
    # swap in a different (validly-encoded) email but keep the original signature
    assert not valid_session_token(f"{other_b64}.{sig}")

def test_valid_session_token_rejects_junk():
    assert not valid_session_token("")
    assert not valid_session_token("bad")
    assert not valid_session_token("no-dot-at-all")
    assert not valid_session_token("not-base64!!!.deadbeef")
