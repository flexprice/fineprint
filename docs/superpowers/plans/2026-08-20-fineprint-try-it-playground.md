# FinePrint "Try it" Playground — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public, interactive `/try` playground to FinePrint where a visitor picks a sample (or uploads their own) contract, picks a model, and sees it extract the generic billing schema with annotated citation boxes + structured JSON — capturing a lead when they run their own file.

**Architecture:** Extend the existing Cloud Run FastAPI service (`fineprint/server.py`) with two endpoints — `POST /extract` (resolve doc → OCR → `reasoner.py` over the generic schema → render page images + map cited `line_id`s to normalized boxes) and `POST /lead` (validate → Slack + GCS append → session token). Reuse `pipeline/extractor.py`, `pipeline/reasoner.py`, `fineprint/providers.py`, `fineprint/notify.py`, `fineprint/store.py`. The Next.js frontend adds a `/try` page that calls these endpoints and renders the annotated result. Samples are precomputed (OCR + page images + a default extraction) and cached in GCS.

**Tech Stack:** Python 3.12, FastAPI/uvicorn, PyMuPDF (`fitz`) for page rendering, Datalab (Chandra OCR), OpenRouter (models), google-cloud-storage (GCS), Next.js 16 / React 19 / TypeScript / Tailwind v4.

## Global Constraints

- Generic schema only — fee buckets are `recurring_fee` / `fixed_fee` / `usage_fee` (never `platform_fee`/`hosting_fee`/`llm_usage_fee`). Never surface Vapi/Flexprice-product terms in playground output.
- No private client contracts anywhere public. Samples are public EDGAR/CUAD only.
- Uploaded files are processed transiently and **never persisted**; the leads store holds email/company/model/sample-type only — never file contents.
- Auth: the benchmark endpoints keep `X-FinePrint-Token`; the new public endpoints (`/extract`, `/lead`) are token-free but CORS-restricted to the site origin + rate-limited.
- Box coordinates are normalized `[x0,y0,x1,y1]` in `0..1` against the OCR page dims, each tagged with a 0-based `page` index.
- Do not add `Co-Authored-By` trailers to commits.
- PyMuPDF import is lazy (inside functions) so the scorer/harness import path stays dependency-light, matching the existing `datalab_sdk` lazy-import pattern in `pipeline/extractor.py`.

---

## File Structure

**Backend (create)**
- `pipeline/render.py` — `render_pages(pdf_bytes, dpi)` → page PNGs + dims; `field_boxes(doc, line_ids)` → normalized boxes grouped by page.
- `fineprint/playground.py` — `extract_document_result(doc, model, want_boxes)` assembling the `/extract` response payload from a `Document`.
- `fineprint/leads.py` — `record_lead(email, company, context)` (validate + Slack + GCS append) and `issue_session_token()` / `valid_session_token()`.
- `fineprint/ratelimit.py` — in-memory sliding-window limiter keyed by client id.
- `fineprint/playground_prep.py` — one-shot: OCR + render + default-model extract the 6 samples → cache JSON+images under `playground/samples/` (local + GCS).

**Backend (modify)**
- `fineprint/config.py` — add `PLAYGROUND_MODELS` (curated ids), `PLAYGROUND_DEFAULT_MODEL`, `SAMPLE_DIR`, `SITE_ORIGINS`.
- `fineprint/server.py` — add `POST /extract`, `POST /lead`, CORS middleware, rate-limit calls.
- `requirements-server.txt` — add `pymupdf`, `python-multipart`.

**Frontend (create)**
- `fineprint/web/lib/playground-api.ts` — typed client (`runExtract`, `submitLead`) + `ExtractResult` types.
- `fineprint/web/components/annotated-result.tsx` — the result view (rendered pages + boxes + Fields/JSON tabs), generalized from `annotated-contract.tsx`.
- `fineprint/web/components/email-gate.tsx` — the modal.
- `fineprint/web/components/playground.tsx` — the client orchestrator (source tabs, sample cards, model picker, run, progress, result).
- `fineprint/web/app/(site)/try/page.tsx` — the route.

**Frontend (modify)**
- `fineprint/web/components/site-nav.tsx` — add "Try it" link.
- `fineprint/web/lib/playground-samples.json` — sample card metadata (id, title, type-label, source).

---

### Task 1: Page render + box mapping (`pipeline/render.py`)

**Files:**
- Create: `pipeline/render.py`
- Test: `pipeline/tests/test_render.py`

**Interfaces:**
- Produces: `render_pages(pdf_bytes: bytes, dpi: int = 110) -> list[dict]` returning `[{"png": bytes, "w": int, "h": int}]` (page order). `field_boxes(doc, line_ids: list[str]) -> list[dict]` returning `[{"page": int, "box": [x0,y0,x1,y1]}]` normalized `0..1`. `doc` is a `pipeline.extractor.Document`.

- [ ] **Step 1: Write the failing test**

```python
# pipeline/tests/test_render.py
from pipeline.extractor import Document, Line
from pipeline.render import field_boxes

def _doc():
    d = Document(stem="x", path="x.pdf", page_dims=[[0, 0, 1000.0, 2000.0]])
    d.lines = [Line(line_id="x#p0#L1", doc="x", page=0, text="Fee", bbox=[100, 200, 300, 240], ocr_conf=1.0)]
    return d

def test_field_boxes_normalizes_against_page_dims():
    boxes = field_boxes(_doc(), ["x#p0#L1"])
    assert boxes == [{"page": 0, "box": [0.1, 0.1, 0.3, 0.12]}]

def test_field_boxes_skips_unknown_and_empty():
    assert field_boxes(_doc(), ["nope"]) == []
    assert field_boxes(_doc(), []) == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. python -m pytest pipeline/tests/test_render.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'pipeline.render'`

- [ ] **Step 3: Write minimal implementation**

```python
# pipeline/render.py
"""Render PDF pages to PNGs and map OCR line_ids to normalized boxes for the playground overlay."""
from __future__ import annotations


def render_pages(pdf_bytes: bytes, dpi: int = 110) -> list[dict]:
    """Rasterize each PDF page. PyMuPDF is imported lazily (corpus/playground only)."""
    import fitz  # PyMuPDF
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = []
    for page in doc:
        pix = page.get_pixmap(dpi=dpi)
        pages.append({"png": pix.tobytes("png"), "w": pix.width, "h": pix.height})
    doc.close()
    return pages


def field_boxes(doc, line_ids: list[str] | None) -> list[dict]:
    """Cited line_ids -> normalized [x0,y0,x1,y1] boxes (0..1) tagged with a 0-based page."""
    by_id = {ln.line_id: ln for ln in doc.lines}
    out = []
    for lid in line_ids or []:
        ln = by_id.get(lid)
        if not ln or ln.page >= len(doc.page_dims):
            continue
        x0d, y0d, x1d, y1d = doc.page_dims[ln.page]
        pw, ph = (x1d - x0d) or 1.0, (y1d - y0d) or 1.0
        bx0, by0, bx1, by1 = ln.bbox
        out.append({"page": ln.page,
                    "box": [round((bx0 - x0d) / pw, 4), round((by0 - y0d) / ph, 4),
                            round((bx1 - x0d) / pw, 4), round((by1 - y0d) / ph, 4)]})
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=. python -m pytest pipeline/tests/test_render.py -v`
Expected: PASS (2 tests). (`render_pages` is exercised in Task 5's manual check — it needs a real PDF + PyMuPDF installed.)

- [ ] **Step 5: Commit**

```bash
git add pipeline/render.py pipeline/tests/test_render.py
git commit -m "feat(playground): page render + line_id->box mapping"
```

---

### Task 2: Extract-result assembly (`fineprint/playground.py`)

**Files:**
- Create: `fineprint/playground.py`
- Test: `fineprint/tests/test_playground.py`

**Interfaces:**
- Consumes: `pipeline.render.field_boxes`; `pipeline.reasoner.FieldEnvelope` (`.field, .value, .confidence, .line_ids, .category`); a `call_fn(model, user) -> (fields, usage, latency)` injected for testability (defaults to `fineprint.providers.call`).
- Produces: `extract_result(doc, model: dict, call_fn=None, want_boxes=True) -> dict` shaped `{"fields": [{"field","value","confidence","category","boxes"}], "model": str, "latency": float, "in": int, "out": int}`.

- [ ] **Step 1: Write the failing test**

```python
# fineprint/tests/test_playground.py
from types import SimpleNamespace
from pipeline.extractor import Document, Line
from fineprint.playground import extract_result

def _doc():
    d = Document(stem="x", path="x.pdf", page_dims=[[0, 0, 1000.0, 2000.0]])
    d.lines = [Line(line_id="x#p0#L1", doc="x", page=0, text="Fee", bbox=[100, 200, 300, 240], ocr_conf=1.0)]
    return d

def _fe(field, value, cat, line_ids):
    return SimpleNamespace(field=field, value=value, confidence="HIGH", line_ids=line_ids, category=cat)

def test_extract_result_shapes_fields_and_boxes():
    fake_call = lambda model, user: ([_fe("recurring_fee.amount", "10000", "Recurring Fee", ["x#p0#L1"])],
                                     {"in": 5, "out": 2}, 1.5)
    r = extract_result(_doc(), {"id": "m", "label": "M"}, call_fn=fake_call)
    assert r["model"] == "M" and r["latency"] == 1.5 and r["in"] == 5
    f = r["fields"][0]
    assert f["field"] == "recurring_fee.amount" and f["category"] == "Recurring Fee"
    assert f["boxes"] == [{"page": 0, "box": [0.1, 0.1, 0.3, 0.12]}]

def test_extract_result_field_without_citation_has_no_box():
    fake_call = lambda model, user: ([_fe("payment_terms", "Net 30", "Payment", [])], {"in": 1, "out": 1}, 0.4)
    r = extract_result(_doc(), {"id": "m", "label": "M"}, call_fn=fake_call)
    assert r["fields"][0]["boxes"] == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. python -m pytest fineprint/tests/test_playground.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'fineprint.playground'`

- [ ] **Step 3: Write minimal implementation**

```python
# fineprint/playground.py
"""Assemble the /extract response: run a model over an OCR'd Document, attach citation boxes."""
from pipeline.render import field_boxes
from fineprint.config import OVERRIDES_DIR

_RULES = ((OVERRIDES_DIR / "default.md").read_text() + "\n\n" +
          (OVERRIDES_DIR / "base_client.md").read_text())


def extract_result(doc, model: dict, call_fn=None, want_boxes: bool = True) -> dict:
    if call_fn is None:
        from fineprint.providers import build_user, call
        user = build_user(doc, _RULES)
        call_fn = lambda m, _u=user: call(m, _u)
        fields, usage, latency = call_fn(model)
    else:
        fields, usage, latency = call_fn(model, "")
    out_fields = [{
        "field": f.field, "value": f.value, "confidence": f.confidence,
        "category": getattr(f, "category", "Other"),
        "boxes": field_boxes(doc, f.line_ids) if want_boxes else [],
    } for f in fields]
    return {"fields": out_fields, "model": model.get("label", model.get("id", "")),
            "latency": round(latency, 2), "in": usage.get("in", 0), "out": usage.get("out", 0)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=. python -m pytest fineprint/tests/test_playground.py -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add fineprint/playground.py fineprint/tests/test_playground.py
git commit -m "feat(playground): extract-result assembly with citation boxes"
```

---

### Task 3: Lead capture (`fineprint/leads.py`)

**Files:**
- Create: `fineprint/leads.py`
- Test: `fineprint/tests/test_leads.py`

**Interfaces:**
- Consumes: `fineprint.notify.post_slack`; `fineprint.store` (upload/download for GCS append — optional, no-op if bucket unset).
- Produces: `valid_email(email: str) -> bool`; `record_lead(email, company, context: dict, notify_fn=None, store_append=None) -> str` returning an opaque `session_token` (raises `ValueError` on bad email); `valid_session_token(tok: str) -> bool`.

- [ ] **Step 1: Write the failing test**

```python
# fineprint/tests/test_leads.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. python -m pytest fineprint/tests/test_leads.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'fineprint.leads'`

- [ ] **Step 3: Write minimal implementation**

```python
# fineprint/leads.py
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
```

- [ ] **Step 4: Add the `store.download_json` / `upload_json` helpers the appender needs**

In `fineprint/store.py`, add (near the existing sync helpers):

```python
def download_json(rel_path: str):
    """Read a JSON object from the bucket, or None if bucket/blob absent."""
    import json
    bucket = _bucket()
    if bucket is None:
        return None
    blob = bucket.blob(rel_path)
    return json.loads(blob.download_as_text()) if blob.exists() else None


def upload_json(rel_path: str, obj) -> None:
    import json
    bucket = _bucket()
    if bucket is None:
        return
    bucket.blob(rel_path).upload_from_string(json.dumps(obj), content_type="application/json")
```

(If `store.py` has no `_bucket()` accessor, add one returning the cached `google.cloud.storage` bucket or `None` when `FINEPRINT_BUCKET` is unset — mirror the existing lazy-client pattern in that file.)

- [ ] **Step 5: Run tests to verify pass**

Run: `PYTHONPATH=. python -m pytest fineprint/tests/test_leads.py -v`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add fineprint/leads.py fineprint/store.py fineprint/tests/test_leads.py
git commit -m "feat(playground): lead capture (validate, Slack, GCS append, session token)"
```

---

### Task 4: Rate limiter (`fineprint/ratelimit.py`)

**Files:**
- Create: `fineprint/ratelimit.py`
- Test: `fineprint/tests/test_ratelimit.py`

**Interfaces:**
- Produces: `Limiter(max_hits: int, window_s: int)` with `.allow(key: str, now: float) -> bool` (sliding window, in-memory).

- [ ] **Step 1: Write the failing test**

```python
# fineprint/tests/test_ratelimit.py
from fineprint.ratelimit import Limiter

def test_allows_up_to_limit_then_blocks_then_recovers():
    lim = Limiter(max_hits=2, window_s=60)
    assert lim.allow("ip1", now=1000.0)
    assert lim.allow("ip1", now=1001.0)
    assert not lim.allow("ip1", now=1002.0)          # 3rd within window blocked
    assert lim.allow("ip1", now=1062.0)              # window slid past first two
    assert lim.allow("ip2", now=1002.0)              # separate key unaffected
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. python -m pytest fineprint/tests/test_ratelimit.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Write minimal implementation**

```python
# fineprint/ratelimit.py
"""Tiny in-memory sliding-window rate limiter for the public playground endpoints."""
from collections import defaultdict, deque


class Limiter:
    def __init__(self, max_hits: int, window_s: int):
        self.max_hits, self.window_s = max_hits, window_s
        self._hits: dict[str, deque] = defaultdict(deque)

    def allow(self, key: str, now: float) -> bool:
        q = self._hits[key]
        while q and now - q[0] > self.window_s:
            q.popleft()
        if len(q) >= self.max_hits:
            return False
        q.append(now)
        return True
```

- [ ] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=. python -m pytest fineprint/tests/test_ratelimit.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add fineprint/ratelimit.py fineprint/tests/test_ratelimit.py
git commit -m "feat(playground): in-memory sliding-window rate limiter"
```

---

### Task 5: Config + curated models + sample manifest

**Files:**
- Modify: `fineprint/config.py`
- Create: `fineprint/web/lib/playground-samples.json`
- Modify: `requirements-server.txt`

**Interfaces:**
- Produces: `config.PLAYGROUND_MODELS: list[str]` (curated ids), `config.PLAYGROUND_DEFAULT_MODEL: str`, `config.SAMPLE_DIR: Path`, `config.SITE_ORIGINS: list[str]`.

- [ ] **Step 1: Add config values**

Append to `fineprint/config.py`:

```python
# ── playground ───────────────────────────────────────────────────────────────
PLAYGROUND_MODELS = os.environ.get(
    "FINEPRINT_PLAYGROUND_MODELS",
    "gpt-5.5,claude-fable-5,grok-4.6,gemini-3.5-flash-lite,gpt-5.6-luna,deepseek-v3.2",
).split(",")
PLAYGROUND_DEFAULT_MODEL = os.environ.get("FINEPRINT_PLAYGROUND_DEFAULT", "gpt-5.5")
SAMPLE_DIR = Path(os.environ.get("FINEPRINT_SAMPLE_DIR", HERE / "playground" / "samples"))
SITE_ORIGINS = os.environ.get(
    "FINEPRINT_SITE_ORIGINS", "https://fineprint.flexprice.io,http://localhost:3000,http://localhost:3200",
).split(",")
```

- [ ] **Step 2: Add server deps**

Append to `requirements-server.txt`:

```
pymupdf
python-multipart
```

- [ ] **Step 3: Create the sample card manifest**

```json
// fineprint/web/lib/playground-samples.json
[
  { "id": "guidewire",   "title": "Software License Agreement", "type": "License agreement", "source": "SEC EX-10.27" },
  { "id": "saas",        "title": "SaaS Subscription Agreement", "type": "Subscription",       "source": "SEC EX-10" },
  { "id": "msa",         "title": "Master Services Agreement",   "type": "Services",           "source": "CUAD · CC BY 4.0" },
  { "id": "orderform",   "title": "Order Form (fee schedule)",   "type": "Order form",         "source": "SEC EX-10" },
  { "id": "hosting",     "title": "Hosting / Reseller Agreement","type": "Hosting",            "source": "CUAD · CC BY 4.0" },
  { "id": "maintenance", "title": "Maintenance & Support",       "type": "Support",            "source": "SEC EX-10" }
]
```

- [ ] **Step 4: Verify config imports cleanly**

Run: `PYTHONPATH=. python -c "from fineprint import config; print(config.PLAYGROUND_MODELS, config.SITE_ORIGINS)"`
Expected: prints the 6 model ids and the origin list, no error.

- [ ] **Step 5: Commit**

```bash
git add fineprint/config.py requirements-server.txt fineprint/web/lib/playground-samples.json
git commit -m "feat(playground): config (curated models, sample dir, origins) + sample manifest"
```

---

### Task 6: Server endpoints `/extract` + `/lead` (`fineprint/server.py`)

**Files:**
- Modify: `fineprint/server.py`
- Test: `fineprint/tests/test_server_playground.py`

**Interfaces:**
- Consumes: `extract_result` (Task 2), `record_lead`/`valid_session_token` (Task 3), `Limiter` (Task 4), `render_pages` (Task 1), `pipeline.extractor.extract_document`, `config.PLAYGROUND_MODELS/SAMPLE_DIR/SITE_ORIGINS`, `config.all_models`.
- Produces HTTP: `POST /lead {email,company,context} -> {session_token}`; `POST /extract` (JSON `{sample_id, model}` or multipart `{file, model, session_token}`) `-> {pages:[{image,w,h}], fields:[...], model, latency}` where `image` is a `data:image/png;base64,...` URI.

- [ ] **Step 1: Write the failing test** (FastAPI `TestClient`, model call + OCR mocked)

```python
# fineprint/tests/test_server_playground.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. python -m pytest fineprint/tests/test_server_playground.py -v`
Expected: FAIL (routes `/lead`, `/extract` return 404 / attribute errors)

- [ ] **Step 3: Add CORS + the endpoints to `server.py`**

Add near the top-level app setup:

```python
from fastapi.middleware.cors import CORSMiddleware
from fastapi import UploadFile, File, Form
import base64, time
from fineprint import leads, playground
from fineprint.ratelimit import Limiter
from fineprint.config import PLAYGROUND_MODELS, SAMPLE_DIR, SITE_ORIGINS, all_models

app.add_middleware(CORSMiddleware, allow_origins=SITE_ORIGINS,
                   allow_methods=["POST", "OPTIONS"], allow_headers=["*"])
_limiter = Limiter(max_hits=int(os.environ.get("FINEPRINT_PLAYGROUND_RPM", "12")), window_s=60)


def _client_id(request) -> str:
    return request.headers.get("x-forwarded-for", request.client.host if request.client else "anon").split(",")[0]


def _resolve_model(model_id: str) -> dict:
    m = next((x for x in all_models() if x["id"] == model_id), None)
    if not m:
        from fastapi import HTTPException
        raise HTTPException(400, f"unknown model {model_id}")
    return m


def _load_sample_result(sample_id: str, model_id: str) -> dict:
    """Precomputed default extraction (instant) or live-run the model over cached sample OCR."""
    import pickle, json as _json
    base = SAMPLE_DIR / sample_id
    default_path = base / "result.json"
    if model_id == json.loads((base / "meta.json").read_text())["default_model"] and default_path.exists():
        return _json.loads(default_path.read_text())
    doc = pickle.loads((base / "doc.pkl").read_bytes())
    pages = _json.loads((base / "pages.json").read_text())   # precomputed page images
    res = playground.extract_result(doc, _resolve_model(model_id))
    res["pages"] = pages
    return res


@app.post("/lead")
async def lead(request: Request):
    body = await request.json()
    try:
        tok = leads.record_lead(email=body.get("email"), company=body.get("company"),
                                context=body.get("context") or {})
    except ValueError:
        from fastapi import HTTPException
        raise HTTPException(422, "invalid email")
    return {"session_token": tok}


@app.post("/extract")
async def extract(request: Request, file: UploadFile = File(None),
                  model: str = Form(None), session_token: str = Form(None)):
    from fastapi import HTTPException
    if not _limiter.allow(_client_id(request), time.time()):
        raise HTTPException(429, "rate limit — try again shortly")
    if file is None:                                   # JSON sample path
        body = await request.json()
        return _load_sample_result(body["sample_id"], body.get("model", PLAYGROUND_MODELS[0]))
    # upload path — gated
    if not leads.valid_session_token(session_token or ""):
        raise HTTPException(401, "enter your work email to run your own contract")
    pdf = await file.read()
    if len(pdf) > 10 * 1024 * 1024:
        raise HTTPException(413, "PDF too large (max 10 MB)")
    from pipeline.extractor import extract_document
    from pipeline.render import render_pages
    import tempfile, os as _os
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tf:
        tf.write(pdf); tmp = tf.name
    try:
        doc = extract_document(tmp)                     # live Datalab OCR
        res = playground.extract_result(doc, _resolve_model(model or PLAYGROUND_MODELS[0]))
        res["pages"] = [{"image": "data:image/png;base64," + base64.b64encode(p["png"]).decode(),
                         "w": p["w"], "h": p["h"]} for p in render_pages(pdf)]
        return res
    finally:
        _os.unlink(tmp)                                 # never persist the upload
```

(If `server.py` imports are grouped at top, place the new imports there; keep `Request` — already imported by the existing handlers.)

- [ ] **Step 4: Run tests to verify pass**

Run: `PYTHONPATH=. python -m pytest fineprint/tests/test_server_playground.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add fineprint/server.py fineprint/tests/test_server_playground.py
git commit -m "feat(playground): /extract + /lead endpoints with CORS + rate limit + upload gate"
```

---

### Task 7: Sample precompute script (`fineprint/playground_prep.py`)

**Files:**
- Create: `fineprint/playground_prep.py`
- Test: `fineprint/tests/test_playground_prep.py` (manifest/shape only; OCR is manual)

**Interfaces:**
- Produces: `prep_sample(sample_id, pdf_path, default_model_id) -> None` writing `SAMPLE_DIR/<id>/{doc.pkl, pages.json, meta.json, result.json}`; `build_pages_json(pdf_bytes) -> list[dict]` (data-URI page images).

- [ ] **Step 1: Write the failing test** (pure `build_pages_json` with `render_pages` mocked)

```python
# fineprint/tests/test_playground_prep.py
import fineprint.playground_prep as prep

def test_build_pages_json_encodes_data_uris(monkeypatch):
    monkeypatch.setattr(prep, "render_pages", lambda b: [{"png": b"\x89PNG", "w": 8, "h": 9}])
    pages = prep.build_pages_json(b"%PDF")
    assert pages[0]["w"] == 8 and pages[0]["image"].startswith("data:image/png;base64,")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. python -m pytest fineprint/tests/test_playground_prep.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Write minimal implementation**

```python
# fineprint/playground_prep.py
"""One-shot prep: OCR + render + default-model extract each public sample -> SAMPLE_DIR cache.

    PYTHONPATH=. python -m fineprint.playground_prep guidewire path/to/guidewire.pdf gpt-5.5
"""
import base64, json, pickle, sys
from pipeline.render import render_pages
from fineprint.config import SAMPLE_DIR, PLAYGROUND_DEFAULT_MODEL, all_models


def build_pages_json(pdf_bytes: bytes) -> list[dict]:
    return [{"image": "data:image/png;base64," + base64.b64encode(p["png"]).decode(),
             "w": p["w"], "h": p["h"]} for p in render_pages(pdf_bytes)]


def prep_sample(sample_id: str, pdf_path: str, default_model_id: str = PLAYGROUND_DEFAULT_MODEL) -> None:
    from pipeline.extractor import extract_document
    from fineprint.playground import extract_result
    out = SAMPLE_DIR / sample_id
    out.mkdir(parents=True, exist_ok=True)
    pdf = open(pdf_path, "rb").read()
    doc = extract_document(pdf_path)
    (out / "doc.pkl").write_bytes(pickle.dumps(doc))
    (out / "pages.json").write_text(json.dumps(build_pages_json(pdf)))
    (out / "meta.json").write_text(json.dumps({"default_model": default_model_id}))
    model = next(m for m in all_models() if m["id"] == default_model_id)
    res = extract_result(doc, model)
    res["pages"] = json.loads((out / "pages.json").read_text())
    (out / "result.json").write_text(json.dumps(res))
    print(f"prepped {sample_id} -> {out}")


if __name__ == "__main__":
    prep_sample(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else PLAYGROUND_DEFAULT_MODEL)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `PYTHONPATH=. python -m pytest fineprint/tests/test_playground_prep.py -v`
Expected: PASS

- [ ] **Step 5: Manual — prep the 6 samples** (requires `CHANDRA_OCR_API_KEY` + `OPENROUTER_API_KEY` + `pip install pymupdf`)

For each of the 6 public PDFs (source per `playground-samples.json`), run:
`PYTHONPATH=. python -m fineprint.playground_prep <id> <pdf_path> gpt-5.5`
Then sync `fineprint/playground/samples/` to GCS (`gsutil -m cp -r fineprint/playground/samples gs://$FINEPRINT_BUCKET/playground/`). Verify each `<id>/result.json` has non-empty `fields` + `pages`.

- [ ] **Step 6: Commit**

```bash
git add fineprint/playground_prep.py fineprint/tests/test_playground_prep.py
git commit -m "feat(playground): sample precompute (OCR + render + default extraction)"
```

---

### Task 8: Frontend API client (`lib/playground-api.ts`)

**Files:**
- Create: `fineprint/web/lib/playground-api.ts`
- Modify: `fineprint/web/.env` usage — read `NEXT_PUBLIC_FINEPRINT_API` (the Cloud Run base URL)

**Interfaces:**
- Produces: `type Box = {page:number; box:[number,number,number,number]}`; `type Field = {field:string; value:string; confidence:string; category:string; boxes:Box[]}`; `type ExtractResult = {pages:{image:string;w:number;h:number}[]; fields:Field[]; model:string; latency:number}`; `runExtract(opts) => Promise<ExtractResult>`; `submitLead(email,company,context) => Promise<{session_token:string}>`.

- [ ] **Step 1: Write the client**

```typescript
// fineprint/web/lib/playground-api.ts
const API = process.env.NEXT_PUBLIC_FINEPRINT_API ?? "https://fineprint-wo5ok35f7q-uc.a.run.app";

export type Box = { page: number; box: [number, number, number, number] };
export type Field = { field: string; value: string; confidence: string; category: string; boxes: Box[] };
export type ExtractResult = { pages: { image: string; w: number; h: number }[]; fields: Field[]; model: string; latency: number };

export async function submitLead(email: string, company: string, context: Record<string, unknown>) {
  const r = await fetch(`${API}/lead`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, company, context }),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail ?? "lead failed");
  return (await r.json()) as { session_token: string };
}

export async function runExtract(opts:
  | { sampleId: string; model: string }
  | { file: File; model: string; sessionToken: string }): Promise<ExtractResult> {
  let res: Response;
  if ("sampleId" in opts) {
    res = await fetch(`${API}/extract`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ sample_id: opts.sampleId, model: opts.model }),
    });
  } else {
    const fd = new FormData();
    fd.append("file", opts.file); fd.append("model", opts.model); fd.append("session_token", opts.sessionToken);
    res = await fetch(`${API}/extract`, { method: "POST", body: fd });
  }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail ?? `extract failed (${res.status})`);
  return (await res.json()) as ExtractResult;
}
```

- [ ] **Step 2: Type-check**

Run: `cd fineprint/web && npx tsc --noEmit`
Expected: no errors from `playground-api.ts`.

- [ ] **Step 3: Commit**

```bash
git add fineprint/web/lib/playground-api.ts
git commit -m "feat(playground): typed API client for /extract and /lead"
```

---

### Task 9: Annotated result component (`components/annotated-result.tsx`)

**Files:**
- Create: `fineprint/web/components/annotated-result.tsx`
- Test: `fineprint/web/components/__tests__/annotated-result.test.tsx` (React Testing Library; if the repo has no RTL setup, replace with a Storybook-less render smoke check via `tsc` + a manual note)

**Interfaces:**
- Consumes: `ExtractResult`, `Field`, `Box` from `playground-api.ts`.
- Produces: `export function AnnotatedResult({ result }: { result: ExtractResult })` — renders page images with overlay boxes + a Fields/JSON tabbed panel; hovering a field row highlights its boxes and vice-versa. Reuses the `CAT_COLOR` generic category map from `annotated-contract.tsx` (extract it into a shared `lib/categories.ts` in Step 1).

- [ ] **Step 1: Extract the shared category color map**

Create `fineprint/web/lib/categories.ts`:

```typescript
export const CAT_COLOR: Record<string, string> = {
  Term: "#7b84e6", Parties: "#5aa9c9", "Recurring Fee": "#33b39c", "Usage Fee": "#b06fd0",
  "One-time Fee": "#33a06a", Payment: "#e08a3c", Penalty: "#e06a6a", Commitment: "#3aa6e0",
  Discount: "#d081a8", Other: "#98a0ab",
};
```
Update `annotated-contract.tsx` to import `CAT_COLOR` from `@/lib/categories` (delete its local copy).

- [ ] **Step 2: Write the failing test**

```tsx
// fineprint/web/components/__tests__/annotated-result.test.tsx
import { render, screen } from "@testing-library/react";
import { AnnotatedResult } from "@/components/annotated-result";

const result = {
  model: "GPT-5.5", latency: 1.2,
  pages: [{ image: "data:image/png;base64,AAAA", w: 800, h: 1000 }],
  fields: [{ field: "recurring_fee.amount", value: "$10,000", confidence: "HIGH",
             category: "Recurring Fee", boxes: [{ page: 0, box: [0.1, 0.1, 0.3, 0.12] }] }],
};

test("renders fields and a box overlay", () => {
  render(<AnnotatedResult result={result as any} />);
  expect(screen.getByText("recurring_fee.amount")).toBeInTheDocument();
  expect(screen.getByText("$10,000")).toBeInTheDocument();
  expect(document.querySelectorAll('[data-box]').length).toBe(1);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd fineprint/web && npx vitest run components/__tests__/annotated-result.test.tsx`
Expected: FAIL (component not found). *(If no test runner is configured, add `vitest` + `@testing-library/react` as devDeps and a `jsdom` env — do this in this step, then re-run.)*

- [ ] **Step 4: Implement the component**

```tsx
// fineprint/web/components/annotated-result.tsx
"use client";
import { useState } from "react";
import { CAT_COLOR } from "@/lib/categories";
import type { ExtractResult } from "@/lib/playground-api";

export function AnnotatedResult({ result }: { result: ExtractResult }) {
  const [hot, setHot] = useState<number | null>(null);
  const [tab, setTab] = useState<"fields" | "json">("fields");
  const jsonObj = Object.fromEntries(result.fields.map((f) => [f.field, { value: f.value, confidence: f.confidence }]));
  return (
    <div className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-5 items-start">
      <div className="rounded-xl overflow-hidden border border-line-2 bg-white">
        {result.pages.map((pg, pi) => (
          <div key={pi} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pg.image} alt={`page ${pi + 1}`} className="w-full block" />
            {result.fields.flatMap((f, fi) =>
              f.boxes.filter((b) => b.page === pi).map((b, bi) => {
                const c = CAT_COLOR[f.category] ?? CAT_COLOR.Other;
                const on = hot === fi;
                return (
                  <div key={`${fi}-${bi}`} data-box onMouseEnter={() => setHot(fi)} onMouseLeave={() => setHot(null)}
                    className="absolute cursor-pointer rounded-[2px]"
                    style={{ left: `${b.box[0] * 100}%`, top: `${b.box[1] * 100}%`,
                      width: `${(b.box[2] - b.box[0]) * 100}%`, height: `${(b.box[3] - b.box[1]) * 100}%`,
                      border: `1.5px solid ${c}${on ? "" : "99"}`, background: on ? `${c}30` : "transparent",
                      boxShadow: on ? `0 0 0 2px ${c}66` : "none", transition: "all .12s" }} />
                );
              }))}
          </div>
        ))}
      </div>
      <div className="card rounded-xl">
        <div className="px-4 py-3 flex items-center justify-between border-b border-line">
          <span className="font-mono text-[11px] text-muted">{result.model} · read in {result.latency}s</span>
          <div className="flex gap-1 bg-surface-2 rounded-lg p-0.5">
            {(["fields", "json"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1 rounded-md text-[12.5px] font-medium ${tab === t ? "bg-panel text-text shadow-sm" : "text-muted"}`}>
                {t === "fields" ? "Fields" : "JSON"}</button>
            ))}
          </div>
        </div>
        {tab === "fields" ? (
          <div className="flex flex-col p-1.5">
            {result.fields.map((f, fi) => {
              const c = CAT_COLOR[f.category] ?? CAT_COLOR.Other;
              return (
                <button key={f.field} onMouseEnter={() => setHot(fi)} onMouseLeave={() => setHot(null)}
                  className="text-left px-3 py-2.5 rounded-lg flex items-center gap-3"
                  style={{ background: hot === fi ? "var(--surface-2)" : "transparent" }}>
                  <span className="size-2 rounded-[3px] shrink-0" style={{ background: c }} />
                  <span className="font-mono text-[11.5px] text-muted w-[130px] shrink-0 truncate">{f.field}</span>
                  <span className="text-[13px] tnum flex-1 truncate">{f.value}</span>
                  <span className={`font-mono text-[9.5px] ${f.confidence === "HIGH" ? "text-faint" : "text-warning"}`}>
                    {f.confidence === "HIGH" ? "HIGH" : "REVIEW"}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <pre className="p-4 text-[11.5px] font-mono overflow-auto max-h-[560px]">{JSON.stringify(jsonObj, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd fineprint/web && npx vitest run components/__tests__/annotated-result.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add fineprint/web/components/annotated-result.tsx fineprint/web/lib/categories.ts fineprint/web/components/annotated-contract.tsx fineprint/web/components/__tests__/annotated-result.test.tsx
git commit -m "feat(playground): annotated-result component (pages+boxes, Fields/JSON) + shared categories"
```

---

### Task 10: Email-gate modal (`components/email-gate.tsx`)

**Files:**
- Create: `fineprint/web/components/email-gate.tsx`

**Interfaces:**
- Produces: `export function EmailGate({ open, onClose, onSubmitted }: { open: boolean; onClose: () => void; onSubmitted: (token: string) => void })` — collects work email + company, calls `submitLead`, calls `onSubmitted(session_token)` on success.

- [ ] **Step 1: Implement the modal**

```tsx
// fineprint/web/components/email-gate.tsx
"use client";
import { useState } from "react";
import { submitLead } from "@/lib/playground-api";

export function EmailGate({ open, onClose, onSubmitted, context }:
  { open: boolean; onClose: () => void; onSubmitted: (t: string) => void; context: Record<string, unknown> }) {
  const [email, setEmail] = useState(""); const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  if (!open) return null;
  async function go() {
    setBusy(true); setErr("");
    try { const { session_token } = await submitLead(email, company, context); onSubmitted(session_token); }
    catch (e) { setErr(e instanceof Error ? e.message : "try again"); } finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-5 bg-[rgba(9,20,28,.55)] backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-[min(440px,100%)] rounded-2xl bg-panel border border-line p-7 shadow-2xl">
        <h3 className="text-xl font-semibold tracking-tight">See how models read your contract</h3>
        <p className="mt-1.5 text-[14px] text-muted">Enter your work email to run extraction on your own document.</p>
        <label className="block font-mono text-[10.5px] uppercase tracking-wide text-faint mt-4 mb-1.5">Work email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
          className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-[14px]" />
        <label className="block font-mono text-[10.5px] uppercase tracking-wide text-faint mt-3 mb-1.5">Company</label>
        <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Inc."
          className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-[14px]" />
        {err && <p className="mt-2 text-[12.5px] text-warning">{err}</p>}
        <button disabled={busy} onClick={go}
          className="mt-4 w-full rounded-xl bg-navy text-bg py-3 text-[14px] font-bold disabled:opacity-60">
          {busy ? "Running…" : "Run extraction →"}</button>
        <p className="mt-3 text-[11.5px] text-faint text-center">We&rsquo;ll only use this to follow up about FinePrint. Your file is not stored.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd fineprint/web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add fineprint/web/components/email-gate.tsx
git commit -m "feat(playground): email-gate modal"
```

---

### Task 11: Playground orchestrator + `/try` route + nav

**Files:**
- Create: `fineprint/web/components/playground.tsx`
- Create: `fineprint/web/app/(site)/try/page.tsx`
- Modify: `fineprint/web/components/site-nav.tsx`

**Interfaces:**
- Consumes: `runExtract`, `ExtractResult` (Task 8); `AnnotatedResult` (Task 9); `EmailGate` (Task 10); `playground-samples.json` (Task 5); `PLAYGROUND_MODELS` mirrored client-side as a labeled list.

- [ ] **Step 1: Implement the orchestrator** (source tabs, sample cards, model select, run, progress, result)

```tsx
// fineprint/web/components/playground.tsx
"use client";
import { useState } from "react";
import samples from "@/lib/playground-samples.json";
import { runExtract, type ExtractResult } from "@/lib/playground-api";
import { AnnotatedResult } from "@/components/annotated-result";
import { EmailGate } from "@/components/email-gate";

const CURATED = [
  { id: "gpt-5.5", label: "GPT-5.5 — #1 · 82.2%" },
  { id: "claude-fable-5", label: "Claude Fable 5 — #2 · 81.8%" },
  { id: "grok-4.6", label: "Grok 4.6 — #3 · 80.7%" },
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite — best value" },
  { id: "gpt-5.6-luna", label: "GPT-5.6 Luna — fastest" },
  { id: "deepseek-v3.2", label: "DeepSeek V3.2 — #19" },
];

export function Playground() {
  const [tab, setTab] = useState<"sample" | "upload">("sample");
  const [sampleId, setSampleId] = useState(samples[0].id);
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState(CURATED[0].id);
  const [token, setToken] = useState<string | null>(null);
  const [gate, setGate] = useState(false);
  const [status, setStatus] = useState<"" | "running" | "error">("");
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [err, setErr] = useState("");

  async function run() {
    if (tab === "upload") {
      if (!file) { setErr("Choose a PDF first."); return; }
      if (!token) { setGate(true); return; }               // gate first BYO run
    }
    setStatus("running"); setErr("");
    try {
      const res = tab === "sample"
        ? await runExtract({ sampleId, model })
        : await runExtract({ file: file!, model, sessionToken: token! });
      setResult(res); setStatus("");
    } catch (e) { setErr(e instanceof Error ? e.message : "failed"); setStatus("error"); }
  }

  return (
    <div>
      <div className="panel rounded-2xl p-5 mb-6">
        <div className="flex gap-1 bg-surface-2 rounded-xl p-1 w-max mb-4">
          {(["sample", "upload"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-[13.5px] font-semibold ${tab === t ? "bg-panel text-text shadow-sm" : "text-muted"}`}>
              {t === "sample" ? "Sample contracts" : "Upload your own"}</button>
          ))}
        </div>
        {tab === "sample" ? (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {samples.map((s) => (
              <button key={s.id} onClick={() => setSampleId(s.id)}
                className={`text-left border rounded-xl p-3.5 ${sampleId === s.id ? "border-accent bg-accent/5" : "border-line"}`}>
                <div className="text-[14px] font-semibold">{s.title}</div>
                <div className="font-mono text-[11px] text-faint mt-1">{s.source}</div>
              </button>
            ))}
          </div>
        ) : (
          <label className="block border border-dashed border-line rounded-xl p-8 text-center text-muted cursor-pointer">
            <input type="file" accept="application/pdf" hidden
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file ? <b className="text-text">{file.name}</b> : <><b className="text-text">Drop a PDF</b>, or click to browse · ≤15 pages / 10 MB</>}
            <div className="text-[12px] text-faint mt-2">Your file is processed to extract terms and is not stored.</div>
          </label>
        )}
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-line-2">
          <select value={model} onChange={(e) => setModel(e.target.value)}
            className="border border-line bg-panel rounded-lg px-3 py-2 text-[13.5px] font-semibold">
            {CURATED.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <button onClick={run} disabled={status === "running"}
            className="ml-auto bg-navy text-bg rounded-xl px-5 py-2.5 text-[14px] font-bold disabled:opacity-60">
            {status === "running" ? "Reading…" : "Run extraction →"}</button>
        </div>
        {err && <p className="mt-3 text-[13px] text-warning">{err}</p>}
      </div>

      {status === "running" && <p className="text-center text-muted text-[14px] py-10 font-mono">OCR&rsquo;ing → reading → rendering…</p>}
      {result && <AnnotatedResult result={result} />}

      <EmailGate open={gate} onClose={() => setGate(false)}
        context={{ kind: "upload", model, sample: null }}
        onSubmitted={(t) => { setToken(t); setGate(false); run(); }} />
    </div>
  );
}
```

- [ ] **Step 2: Create the route**

```tsx
// fineprint/web/app/(site)/try/page.tsx
import { Playground } from "@/components/playground";

export const metadata = { title: "Try it · FinePrint" };

export default function TryPage() {
  return (
    <section className="shell py-14">
      <p className="eyebrow mb-3">Try it yourself</p>
      <h1 className="display text-[clamp(1.9rem,4vw,2.7rem)]">Watch a model read a contract.</h1>
      <p className="mt-4 text-[16px] leading-relaxed text-muted max-w-[62ch]">
        Pick a sample or bring your own, choose a model, and see it extract the billing terms into a
        structured schema — every field cited back to the exact line it read.
      </p>
      <div className="mt-8"><Playground /></div>
    </section>
  );
}
```

- [ ] **Step 3: Add the nav link** — in `fineprint/web/components/site-nav.tsx`, add `{ href: "/try", label: "Try it" }` to the nav-links array (match the existing link structure).

- [ ] **Step 4: Build to verify**

Run: `cd fineprint/web && npm run build`
Expected: compiles; `/try` appears in the route list.

- [ ] **Step 5: Manual smoke** — `npm run start -- -p 3200`, open `/try`: sample card + model → Run → annotated result renders (needs the backend reachable + a prepped sample); upload tab → Run → email-gate modal appears.

- [ ] **Step 6: Commit**

```bash
git add fineprint/web/components/playground.tsx "fineprint/web/app/(site)/try/page.tsx" fineprint/web/components/site-nav.tsx
git commit -m "feat(playground): /try page — orchestrator, route, nav link"
```

---

### Task 12: Deploy config + docs

**Files:**
- Modify: `deploy/deploy.sh` (env for playground), `fineprint/bootstrap.py` (sync `playground/samples` from GCS at boot), `AUTOMATION.md` (document the endpoints).

- [ ] **Step 1** — In `bootstrap.py`, add `playground/samples` to the GCS prefixes synced down at boot (mirror the existing corpus sync).
- [ ] **Step 2** — In `deploy/deploy.sh`, add env `--set-env-vars FINEPRINT_SITE_ORIGINS=...,FINEPRINT_PLAYGROUND_RPM=12` and ensure `CHANDRA_OCR_API_KEY` is mounted (needed for live BYO OCR). Set `--min-instances 1` (cold starts hurt the interactive demo).
- [ ] **Step 3** — Document `/extract` + `/lead` (inputs, guards, privacy) in `AUTOMATION.md`.
- [ ] **Step 4: Commit**

```bash
git add deploy/deploy.sh fineprint/bootstrap.py AUTOMATION.md
git commit -m "chore(playground): deploy env, sample sync at boot, endpoint docs"
```

---

## Self-Review

**Spec coverage:**
- §4 UX (sample/upload tabs, model dropdown, run, progress, annotated result, Fields/JSON, email gate) → Tasks 9,10,11. ✓
- §5 architecture (`/extract`, `/lead`, reuse extractor/reasoner, PDF→image render, box mapping) → Tasks 1,2,6. ✓
- §6 sample corpus + precompute → Tasks 5,7. ✓
- §7 guards (email gate, rate limit, caps, transient uploads, leads exclude file) → Tasks 3,4,6 (10MB cap + `finally: unlink`; leads row excludes file). ✓
- §8 generic schema → Global Constraints + reuse of the renamed reasoner. ✓
- §9 testing → each task is TDD; frontend RTL in Task 9. ✓
- §10 risks (cold starts → min-instances 1 in Task 12; box graceful-degrade → Task 2 test `..._without_citation_has_no_box`). ✓

**Placeholder scan:** No TBD/TODO; every code step has real code. Manual OCR steps (Task 7 Step 5, Task 11 Step 5) are explicitly manual and list exact commands. ✓

**Type consistency:** `field_boxes` returns `{page,box}` (Task 1) consumed identically in Tasks 2, 6, 9. `ExtractResult`/`Field`/`Box` defined in Task 8, consumed in 9 & 11. `record_lead`/`valid_session_token` names match across Tasks 3 & 6. `extract_result` name consistent across Tasks 2, 6, 7. ✓

**Note for implementer:** Tasks 1–7 (backend) can be built + tested without the frontend; Tasks 8–11 (frontend) depend on Task 8's types and a reachable backend for the manual smoke steps. Task 12 is deploy wiring. If the web app has no test runner configured, Task 9 Step 3 sets one up before proceeding.
