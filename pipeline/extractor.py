"""Stage ①: Datalab (Chandra 2) extraction.

Produces a normalized document model the rest of the pipeline consumes:
  - a flat list of OCR *lines*, each with a stable line_id, page index, text,
    bbox (in OCR/96-DPI space), and OCR confidence  -> the annotation substrate
  - the structured markdown from convert()                -> reasoning context

Two Datalab calls per document (~1-2 cents): ocr() for line boxes, convert()
for reading-ordered structure. Both are cheap and cache-friendly.
"""
from __future__ import annotations
import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import List

from .config import DATALAB_API_KEY, PROJECT_ROOT

# datalab-sdk is only needed to OCR raw PDFs (corpus prep). It's imported lazily inside the
# OCR functions so the benchmark harness (which loads pre-OCR'd Document pickles) and the
# scorer can be imported without the OCR dependency installed.

_CACHE = PROJECT_ROOT / ".ocr_cache"


@dataclass
class Line:
    line_id: str          # e.g. "nutun_of#p0#L12"  (doc-scoped, stable)
    doc: str              # source document stem
    page: int             # 0-based page index
    text: str
    bbox: List[float]     # [x0,y0,x1,y1] in OCR (96-DPI) space
    ocr_conf: float


@dataclass
class Document:
    stem: str
    path: str
    page_dims: List[List[float]]   # per page [x0,y0,x1,y1] in OCR space (from image_bbox)
    lines: List[Line] = field(default_factory=list)
    markdown: str = ""             # structured reading-order context from convert()

    def numbered_lines_text(self) -> str:
        """The reasoning substrate: every line as `L-id: text` so GPT can cite ids."""
        return "\n".join(f"{ln.line_id}: {ln.text}" for ln in self.lines)


def _client():
    from datalab_sdk import DatalabClient
    if not DATALAB_API_KEY:
        raise RuntimeError("CHANDRA_OCR_API_KEY missing from .env")
    return DatalabClient(api_key=DATALAB_API_KEY)


def _raw_ocr(path: Path, want_markdown: bool) -> dict:
    """Datalab ocr() + convert(), cached on disk by file content hash."""
    from datalab_sdk.models import OCROptions, ConvertOptions
    _CACHE.mkdir(exist_ok=True)
    h = hashlib.sha1(path.read_bytes()).hexdigest()[:16]
    cf = _CACHE / f"{h}.json"
    if cf.exists():
        cached = json.loads(cf.read_text())
        if cached.get("has_md") or not want_markdown:
            return cached
    client = _client()
    ocr_res = client.ocr(str(path), options=OCROptions())
    md = ""
    if want_markdown:
        md = (client.convert(str(path), options=ConvertOptions(
            output_format="markdown", paginate=True, disable_image_extraction=True)).markdown or "")
    data = {"pages": ocr_res.pages, "markdown": md, "has_md": want_markdown}
    cf.write_text(json.dumps(data))
    return data


def extract_document(path: str | Path, want_markdown: bool = True) -> Document:
    path = Path(path)
    stem = _short_stem(path.stem)
    raw = _raw_ocr(path, want_markdown)

    doc = Document(stem=stem, path=str(path), page_dims=[], markdown=raw.get("markdown", ""))
    for pi, page in enumerate(raw["pages"]):
        doc.page_dims.append(page.get("image_bbox", [0, 0, 0, 0]))
        for li, ln in enumerate(page.get("text_lines", [])):
            text = (ln.get("text") or "").strip()
            if not text:
                continue
            doc.lines.append(Line(
                line_id=f"{stem}#p{pi}#L{li}",
                doc=stem, page=pi, text=text,
                bbox=[float(x) for x in ln["bbox"]],
                ocr_conf=float(ln.get("confidence", 0.0)),
            ))
    return doc


def extract_bundle(paths: List[str | Path]) -> List[Document]:
    """A customer's contract set (MSA + Order Form + DPA ...)."""
    return [extract_document(p) for p in paths]


def _short_stem(stem: str) -> str:
    """Compact, id-safe doc key from a messy filename."""
    s = stem.lower().replace("copy of", "").strip()
    s = "".join(c if c.isalnum() else "_" for c in s)
    s = "_".join(t for t in s.split("_") if t)
    return s[:40]
