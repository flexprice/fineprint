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
