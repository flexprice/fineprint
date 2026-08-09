# FinePrint corpus

Real, public contracts sourced from **SEC EDGAR** full-text search (EX-10.x material
agreements) — the SaaS / order-form / license agreements whose fee, cadence, entitlement and
commitment terms FinePrint scores.

```bash
python -m fineprint.corpus.collect 200   # download up to 200 into corpus/raw/ + manifest.json
```

**Pipeline (this is the "collect" step):**
1. `collect.py` — download raw exhibits + `manifest.json` (done here)
2. text-extract / OCR each into the pipeline's document form
3. hand-label the billing schema (the ground truth — the slow, high-value step)
4. add to the benchmark seed and re-run

`raw/` and `manifest.json` are **gitignored**: the raw docs are public, but the *specific
curated subset + its labels* are the private holdout that keeps the benchmark un-gameable.
Only anonymized aggregate results are ever published.

Sources are US SEC filings (public records). Respect EDGAR's fair-access policy (descriptive
User-Agent, modest request rate) — the collector already does.
