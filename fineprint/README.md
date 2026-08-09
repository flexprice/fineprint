# FinePrint

**The document-extraction benchmark.** Every new model, scored on real contracts turned into
structured billing data — accuracy, hallucination rate, cost, and latency. Private hand-labeled
holdout, five runs per contract, published the day a model ships.

The harness and web app are open source. The contract corpus and ground-truth labels are **not** —
keeping the test set private is what makes the benchmark hard to game. Only anonymized, per-model
aggregates are ever published.

## Layout

```
fineprint/
├── config.py       curated 35-model catalog (10 labs), seed contracts, roster helpers
├── providers.py    call layer: OpenRouter for every lab, structured-output fallback
├── scoring.py      field-level scorer: economic-equivalence + hallucination rate
├── aggregate.py    pure run → per-model metrics (unit-tested)
├── run.py          the benchmark runner (model × contract × N runs)
├── eval.py         one command: run + score + aggregate + publish a single model
├── export.py       anonymized aggregates + per-doc difficulty → web/lib/data.json
├── pricing.py      OpenRouter price catalogue → data/pricing.json
├── tests/          pytest (scoring + aggregation)
└── web/            Next.js leaderboard (quadrant, 10 analytics charts, OG cards)
```

Private, gitignored: `data/ocr/` (OCR caches), `results/runs.json` (raw runs, carries contract
names), and the ground-truth spreadsheet.

## Score a model — one command

```bash
# run + score + aggregate + publish to the site, then print the metric card
python -m fineprint.eval gpt-5.6-luna               # a curated model
python -m fineprint.eval anthropic/claude-opus-5    # ANY OpenRouter model, resolved live
python -m fineprint.eval qwen/qwen3.8-max --runs 3  # override runs/contract
```

`eval` runs the model across the private contract set, scores every field, folds the raw runs into
metrics (accuracy, hallucination, run-to-run σ, cost, latency p50/p90, value, reliability), merges
them into `results/runs.json`, and rewrites the anonymized `web/lib/data.json` — so the model shows
up on the leaderboard, quadrant, charts, model page, and OG card immediately. A model that isn't in
the curated catalog is resolved from OpenRouter (name, lab, live pricing) and remembered in
`roster.json`.

```bash
python -m fineprint.run                 # sweep the whole catalog (then pricing + export)
python -m pytest fineprint/tests/       # unit tests
cd fineprint/web && npm install && npm run dev
```

Set `OPENROUTER_API_KEY` in the repo `.env` (every lab routes through OpenRouter). Point the harness
at your own labeled data with `FINEPRINT_GROUND_TRUTH` / `FINEPRINT_OCR_DIR`.

## Adding a model to the curated set

Append one row to `_CATALOG` in `config.py` (or just `eval` its OpenRouter id ad-hoc). Pricing is
pulled from OpenRouter automatically; the leaderboard, quadrant, charts, model page, and OG card all
update from the exported data.
