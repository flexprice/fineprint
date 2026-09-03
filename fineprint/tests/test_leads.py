import pytest
from fineprint.leads import (
    valid_email, record_lead, valid_session_token, issue_session_token,
)

def test_valid_email_rejects_junk():
    assert valid_email("a@company.com")
    assert not valid_email("nope")
    assert not valid_email("a@")

def test_record_lead_stores_and_returns_working_token():
    sent = {}
    tok = record_lead("dev@acme.com", "Ada Lovelace", {"sample": "SaaS", "model": "GPT-5.5"},
                      store_append=lambda row: sent.setdefault("row", row))
    assert sent["row"]["email"] == "dev@acme.com" and sent["row"]["name"] == "Ada Lovelace"
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

def test_token_forged_with_the_published_default_secret_is_rejected():
    """The signing secret must never fall back to a value that ships in the open-source repo.

    `_SECRET` used to default to the literal b"fineprint-playground", and the deployed service
    never set FINEPRINT_LEAD_SECRET — so anyone could mint a token that passed the email gate and
    spend the project's OCR + model credits. Verified against production: a token signed with the
    published default reached the 10 MB size check (413) instead of being turned away (401).
    """
    import base64, hashlib, hmac
    email = "attacker@example.com"
    sig = hmac.new(b"fineprint-playground", email.encode(), hashlib.sha256).hexdigest()[:32]
    forged = base64.urlsafe_b64encode(email.encode()).decode().rstrip("=") + "." + sig

    assert not valid_session_token(forged)

def test_record_lead_never_contacts_slack(monkeypatch):
    """Leads no longer post to Slack (a hosted lead-capture form replaces it). Regression guard:
    record_lead must not call notify.post_slack at all, even when SLACK_WEBHOOK_URL is set."""
    from fineprint import notify
    monkeypatch.setenv("SLACK_WEBHOOK_URL", "https://hooks.slack.com/services/fake")
    def boom(*a, **k):
        raise AssertionError("record_lead must not contact Slack")
    monkeypatch.setattr(notify, "post_slack", boom)

    tok = record_lead("dev@acme.com", "Ada Lovelace", {"sample": "SaaS", "model": "GPT-5.5"},
                      store_append=lambda row: None)

    assert valid_session_token(tok)
