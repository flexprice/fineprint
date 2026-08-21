"""Capture playground leads: validate, announce to Slack, append to a stored list, mint a token."""
import base64
import hashlib
import hmac
import json
import os
import re

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_SECRET = os.environ.get("FINEPRINT_LEAD_SECRET", "fineprint-playground").encode()


def valid_email(email: str) -> bool:
    return bool(_EMAIL.match((email or "").strip()))


def _default_notify(text: str) -> None:
    from fineprint import notify
    notify.post_slack(os.environ.get("SLACK_WEBHOOK_URL", ""), text)


def _default_store_append(row: dict) -> None:
    """Append a lead row to GCS playground/leads.json (best-effort; no-op if bucket unset)."""
    from fineprint import store
    existing = store.download_json("playground/leads.json") or []
    existing.append(row)
    store.upload_json("playground/leads.json", existing)


def record_lead(email, name, context: dict, notify_fn=None, store_append=None) -> str:
    email = (email or "").strip()
    if not valid_email(email):
        raise ValueError("invalid email")
    name = (name or "").strip()
    if not name:
        raise ValueError("name required")
    row = {"email": email, "name": name,
           "sample": context.get("sample"), "model": context.get("model"),
           "kind": context.get("kind", "upload")}          # NEVER include file contents
    (notify_fn or _default_notify)(
        f"New FinePrint lead: *{name}* <{email}> ran a {row['sample'] or 'contract'} on {row['model']}")
    (store_append or _default_store_append)(row)
    return issue_session_token(email)


def issue_session_token(email: str) -> str:
    """Self-verifying token that carries the gated email: ``<b64url(email)>.<hmac-sig>``."""
    b64 = base64.urlsafe_b64encode(email.encode()).decode().rstrip("=")
    sig = hmac.new(_SECRET, email.encode(), hashlib.sha256).hexdigest()[:32]
    return f"{b64}.{sig}"


def valid_session_token(tok: str) -> bool:
    """Recompute the HMAC over the embedded email and compare — a bare '<32 hex>.ok' no longer
    validates; only a token minted by issue_session_token (same secret) passes."""
    if not tok or "." not in tok:
        return False
    b64, _, sig = tok.rpartition(".")
    if not b64 or not sig:
        return False
    try:
        padded = b64 + "=" * (-len(b64) % 4)
        email = base64.urlsafe_b64decode(padded.encode()).decode()
    except Exception:
        return False
    expected = hmac.new(_SECRET, email.encode(), hashlib.sha256).hexdigest()[:32]
    return hmac.compare_digest(sig, expected)
