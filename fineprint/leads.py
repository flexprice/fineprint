"""Capture playground leads: validate, append to a stored list, mint a token.

Leads are captured by a hosted external form (not this module) — this only validates the email,
records the row for our own reference, and mints the token that gates the upload path.
"""
import base64
import hashlib
import hmac
import os
import re
import secrets

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
# Signing key for playground session tokens. NEVER fall back to a literal: this file is public, so a
# published default is a forgeable gate — anyone could mint a token, skip the email capture, and
# spend the project's OCR + model credits on an upload. Unset (local dev, tests) now means a random
# per-process key: tokens still work within a run, and none can be forged from outside.
# DEPLOYMENTS MUST SET ``FINEPRINT_LEAD_SECRET`` — otherwise every restart invalidates the tokens
# already handed out, and a multi-instance service can't validate its own.
_SECRET = (os.environ.get("FINEPRINT_LEAD_SECRET") or secrets.token_hex(32)).encode()


def valid_email(email: str) -> bool:
    return bool(_EMAIL.match((email or "").strip()))


def _default_store_append(row: dict) -> None:
    """Append a lead row to GCS playground/leads.json (best-effort; no-op if bucket unset)."""
    from fineprint import store
    existing = store.download_json("playground/leads.json") or []
    existing.append(row)
    store.upload_json("playground/leads.json", existing)


def record_lead(email, name, context: dict, store_append=None) -> str:
    email = (email or "").strip()
    if not valid_email(email):
        raise ValueError("invalid email")
    name = (name or "").strip()
    if not name:
        raise ValueError("name required")
    row = {"email": email, "name": name,
           "sample": context.get("sample"), "model": context.get("model"),
           "kind": context.get("kind", "upload")}          # NEVER include file contents
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
