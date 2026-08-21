"""Assemble the /extract response: run a model over an OCR'd Document, attach citation boxes."""
from pipeline.render import field_boxes
from fineprint.config import OVERRIDES_DIR

_RULES = (OVERRIDES_DIR / "default.md").read_text()

# The reasoner always emits the full generic schema, so a given contract leaves many slots
# empty. The playground shows only what the model actually found — empties are noise, not signal.
_EMPTY = {"", "none", "null", "n/a", "na", "not specified", "not stated", "not provided", "unknown", "-", "—"}


def _has_value(v) -> bool:
    return v is not None and str(v).strip().lower() not in _EMPTY


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
    } for f in fields if _has_value(f.value)]
    return {"fields": out_fields, "model": model.get("label", model.get("id", "")),
            "latency": round(latency, 2), "in": usage.get("in", 0), "out": usage.get("out", 0)}
