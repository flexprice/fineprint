"""Scoring — reuses the Flexprice eval harness (field-level, economic-equivalence aware).

Beyond raw accuracy we surface FinePrint-specific signals: hallucination (the model marked a
field HIGH-confidence but got it wrong). Ground truth is private; only aggregates leave here.
"""
import openpyxl

from pipeline import evaluate as ev
from fineprint.config import GROUND_TRUTH

_TRUTH: dict[str, dict] = {}


def load_truth(name: str) -> dict | None:
    """Exact-name ground-truth row -> {field: normalized_value}. Cached; loaded once."""
    if not _TRUTH:
        ws = openpyxl.load_workbook(GROUND_TRUTH, data_only=True)["Contract Breakdown"]
        for r in range(2, ws.max_row + 1):
            cid = ws.cell(r, 1).value
            if cid:
                _TRUTH[str(cid).strip()] = {f: ev._norm(f, ws.cell(r, c).value) for c, f in ev.COL.items()}
    return _TRUTH.get(name)


def score(fields, truth) -> dict:
    """Per-run scorecard: correct/scored (economic-equivalence aware) + HIGH-confidence
    hallucinations (confident and wrong)."""
    pred = {f.field: ev._norm(f.field, f.value) for f in fields}
    conf = {f.field: f.confidence for f in fields}
    scored = correct = high = confident_wrong = 0
    for f in ev.COL.values():
        if f in ev.SOFT:
            continue
        exp, got = truth.get(f), pred.get(f)
        if exp in (None, 0.0) and got in (None, 0.0):
            continue
        scored += 1
        ok = exp == got
        if not ok and f.rsplit(".", 1)[-1] in ("amount", "frequency"):
            group = f.rsplit(".", 1)[0]
            if group in ("platform_fee", "llm_usage_fee", "hosting_fee"):
                at, ap = ev._annualized(truth, group), ev._annualized(pred, group)
                if at is not None and at == ap:          # $10k/qtr == $40k/yr
                    ok = True
        correct += ok
        if conf.get(f) == "HIGH":
            high += 1
            confident_wrong += not ok
    return {"correct": correct, "scored": scored, "high": high, "confident_wrong": confident_wrong}


def score_detail(fields, truth) -> list[dict]:
    """Per-field audit rows (expected · predicted · raw · confidence · scored · correct).

    Same rules as ``score`` but keeps every field so a run is fully traceable. Written only to the
    private ``results/audit/`` — it carries ground-truth values, so it never leaves the harness.
    """
    pred = {f.field: ev._norm(f.field, f.value) for f in fields}
    raw = {f.field: f.value for f in fields}
    conf = {f.field: f.confidence for f in fields}
    rows = []
    for f in ev.COL.values():
        exp, got = truth.get(f), pred.get(f)
        soft = f in ev.SOFT
        scored = (not soft) and not (exp in (None, 0.0) and got in (None, 0.0))
        ok = None
        if scored:
            ok = exp == got
            if not ok and f.rsplit(".", 1)[-1] in ("amount", "frequency"):
                group = f.rsplit(".", 1)[0]
                if group in ("platform_fee", "llm_usage_fee", "hosting_fee"):
                    at, ap = ev._annualized(truth, group), ev._annualized(pred, group)
                    if at is not None and at == ap:
                        ok = True
        rows.append({"field": f, "expected": exp, "predicted": got, "raw": raw.get(f),
                     "confidence": conf.get(f), "soft": soft, "scored": scored, "correct": ok})
    return rows
