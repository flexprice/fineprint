"""Capture playground leads: validate, announce to Slack, append to a stored list, mint a token."""
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


def record_lead(email, company, context: dict, notify_fn=None, store_append=None) -> str:
    email = (email or "").strip()
    if not valid_email(email):
        raise ValueError("invalid email")
    row = {"email": email, "company": (company or "").strip(),
           "sample": context.get("sample"), "model": context.get("model"),
           "kind": context.get("kind", "upload")}          # NEVER include file contents
    (notify_fn or _default_notify)(
        f"New FinePrint lead: *{email}* ({row['company']}) ran a {row['sample'] or 'contract'} on {row['model']}")
    (store_append or _default_store_append)(row)
    return issue_session_token(email)


def issue_session_token(email: str) -> str:
    return hmac.new(_SECRET, email.encode(), hashlib.sha256).hexdigest()[:32] + ".ok"


def valid_session_token(tok: str) -> bool:
    return bool(tok) and tok.endswith(".ok") and len(tok) == 35
