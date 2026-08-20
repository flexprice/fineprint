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
