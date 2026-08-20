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
