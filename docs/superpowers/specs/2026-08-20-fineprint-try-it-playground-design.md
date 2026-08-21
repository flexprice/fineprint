# FinePrint "Try it" Playground — Design

**Date:** 2026-08-20
**Status:** Approved design, pending spec review
**Owner:** FinePrint / Flexprice

## 1. Problem & goal

FinePrint currently reads as a passive benchmark. The CTO wants an **interactive section** where a visitor can run the extraction themselves — pick a contract, pick a model, and watch the model read the document into a structured schema with annotated citations. This turns the site into a hands-on demo and a **lead magnet**.

Concretely, it productizes the existing Ferry/pipeline flow (**PDF → Chandra/Datalab OCR → model extraction → annotated boxes + structured JSON**) as a public playground on FinePrint, using the **generic billing schema** (not the Flexprice/Vapi-specific one).

**Success criteria**
- A visitor can, in one screen, choose a sample OR upload their own contract, choose a model, run it, and see (a) the rendered page with citation boxes, (b) a clean field-by-field form, and (c) the structured JSON.
- Running your **own** contract captures a lead (work email + company) delivered to the team.
- Sample runs feel instant; live runs show clear progress.
- No private client contracts are exposed; uploaded files are not retained.

## 2. Non-goals (v1)

- No account system / saved history.
- No side-by-side multi-model comparison in one run (there's a "Compare on the leaderboard →" link instead).
- No editing/correcting extracted fields.
- No public-corpus *labeling* or scoring here — this is a demo, not a scored benchmark run. (Public-corpus labeling is a separate, tracked effort.)

## 3. Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| BYO posture | **Email-gate** BYO (work email + company). Sample contracts are open/instant. |
| Model set | **Curated ~6** in the dropdown (labeled with board rank + accuracy) with a **"Show all 43"** toggle. |
| Sample source | **Curated public contracts** (SEC EDGAR EX-10 + CUAD), precomputed. No private client contracts. |
| Lead capture | **Slack notification + append to a stored list** (GCS `leads.json`). Reuses the existing Slack webhook. |
| Architecture | **Extend the existing Cloud Run service** with `/extract` + `/lead`; reuse `extractor.py` + `reasoner.py` + generic schema. |
| Uploaded files | **Processed transiently, not retained** beyond the request. One-line privacy notice shown. |
| Annotation boxes | In v1, **degrade gracefully**: a field with no model line-citation still appears in the form/JSON without a box. Boxes are not a hard blocker for a field. |

## 4. User experience — `/try` ("Try it" in the nav)

> A validated **skeleton mockup** exists (interactive): the layout, controls, annotated-result interaction, and email gate below are the approved structure. It is a **reference skeleton, not final pixels** — visual polish (spacing, motion, empty/loading states, mobile) is part of implementation, following the site's design system.


**Input panel**
- Tabs: **Sample contracts** (6 cards; each a real public agreement labeled by type — e.g. "SaaS subscription · SEC EX-10", "Master services agreement", "Order form w/ fee table") and **Upload your own** (PDF dropzone; ≤ ~15 pages / ≤ 10 MB).
- **Model dropdown**: curated ~6 (rank + accuracy shown); **"Show all 43"** toggle reveals the full roster.
- **Run** button.

**Run behavior**
- Sample + a curated model with a precomputed result → **instant**.
- Otherwise (sample + non-precomputed model, or any BYO) → **live** run with a progress strip: *OCR'ing → reading → rendering → done* (~20s–2min).
- **Email gate**: the first BYO run in a session opens a modal (work email + company). On submit → `/lead` → a session token unlocks BYO for the session.

**Result view** (expanded annotated-contract component)
- **Left**: rendered contract page(s) with colored citation boxes; hover/click a field ↔ its box(es) highlight. Simple page nav for multi-page docs.
- **Right**: two tabs —
  - **Fields**: a form grouped by category (Term, Parties, Fees, Payment, Penalties, Commitment…), each row = field · value · confidence · (citation link).
  - **JSON**: the structured output with a copy button.
- Footer: model badge, "read in Xs", "Compare on the leaderboard →".

## 5. Architecture & data flow

Extend the existing Cloud Run `fineprint` service (Python). Reuses `pipeline/extractor.py` (Datalab OCR → line-level bboxes) and `pipeline/reasoner.py` (model fills the generic schema, **citing the `line_id`s it read from**). New work: a **PDF→page-image render** step (PyMuPDF/`fitz`) for the overlay, plus public-facing guards.

```
Frontend (/try, Next.js)
   │  POST /extract  {sample_id | PDF, model, session_token}
   ▼
Cloud Run fineprint service
   ├─ resolve doc:  sample → cached OCR+images ; upload → Datalab OCR (live) + render pages
   ├─ reasoner.py(model) over OCR lines → fields{value,confidence,line_ids,category}
   ├─ map line_ids → normalized boxes (per page)  [graceful: no cite ⇒ no box]
   └─ return {pages:[{image,w,h}], fields:[{field,value,confidence,category,boxes}], schema_json, model, latency}
```

**Endpoints**
- `POST /extract` — as above. Guards: CORS (site origin), per-session/IP rate limit, PDF size/page caps, email-gate check for uploads, per-run token cap.
- `POST /lead` — `{email, company}` → validate (basic work-email check) → Slack notify (`notify.py`) + append GCS `leads.json` → return `session_token`.

**Reused infra:** Datalab (`CHANDRA_OCR_API_KEY`), OpenRouter (models), Slack webhook, GCS, `providers.py`. New dependency: PyMuPDF for page rendering.

## 6. Sample corpus + precompute

6 curated public contracts (EDGAR EX-10 + CUAD), spanning types (SaaS subscription, master services, order form w/ fee table, license, hosting/reseller), chosen for clear billing terms + clean rendering. A build/prep step precomputes per sample: **page images + OCR line-boxes**, and the **default model's extraction** (so sample+default is instant). Cached in GCS (`playground/samples/…`) and synced at boot like the rest of the state.

## 7. Guards — cost / abuse / privacy

- **Email gate** on uploads; **rate limits** per session/IP (e.g. N runs/hour); **PDF caps** (~15 pages / 10 MB).
- **Model exposure**: curated set by default; pricier models only behind "show all", still rate-limited; **per-run output-token cap**.
- **Uploads transient**: streamed through OCR/model in-memory (or a request-scoped temp path), **deleted after the response**; not persisted. Privacy line: "Your file is processed to extract terms and is not stored."
- Leads store contains email/company + which sample/type + model — **not** the uploaded file contents.

## 8. Schema

Output is the **generic commercial-billing schema** (post-rename): `start_date`/term, `counterparty`, fee lines (`recurring_fee` / `fixed_fee` / `usage_fee`, each amount + cadence + timing), `credit_grant`, `commitment`, `payment_terms`, penalties/late fees, `entitlement`. Grouped by category in the form. The reasoner already emits this — the playground reuses the same prompt/schema as the benchmark, so the demo and the leaderboard stay consistent.

## 9. Testing

- **Backend unit**: `line_id`→normalized-box mapping (incl. multi-page + missing-citation graceful path); `/lead` validation + Slack/GCS side-effects (mocked); rate-limit logic.
- **Backend integration**: `/extract` on a bundled sample with a **mocked** model → response shape + box alignment invariants.
- **Frontend**: result view rendered from fixture data (extends the existing `sample.json` fixture); email-gate modal flow.
- **Manual**: each sample × a couple of models; one real BYO public PDF end-to-end; verify a lead lands in Slack + the store.

## 10. Risks & open items

- **Latency** on live/BYO runs (OCR + slow models). Mitigation: progress UI, curated fast models default, token cap. Consider streaming status.
- **Box reliability** depends on models citing `line_id`s; handled by graceful degradation, but a model that cites poorly yields a boxes-light demo — the curated default should be one that cites well.
- **Cold starts** on Cloud Run (min-instances 0). Consider min-instances 1 for the playground once traffic warrants.
- **Abuse/cost** on "show all 43" + BYO — rate limits + token caps are the primary control; monitor and tighten.
- **Public-corpus labeling** (separate effort) will later let these public contracts be *scored*, not just demoed.
