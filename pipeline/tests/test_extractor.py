from types import SimpleNamespace

import pipeline.extractor as extractor


class _FakeDatalabClient:
    """Stands in for datalab_sdk.DatalabClient so tests never hit the network."""
    def __init__(self):
        self.ocr_calls = 0
        self.convert_calls = 0

    def ocr(self, path, options=None):
        self.ocr_calls += 1
        return SimpleNamespace(pages=[{"image_bbox": [0, 0, 100, 100], "text_lines": []}])

    def convert(self, path, options=None):
        self.convert_calls += 1
        return SimpleNamespace(markdown="hello world")


def test_raw_ocr_cache_false_never_reads_or_writes_disk_cache(tmp_path, monkeypatch):
    """The playground's live-upload path (cache=False) must not persist the OCR'd contract text."""
    cache_dir = tmp_path / ".ocr_cache"
    monkeypatch.setattr(extractor, "_CACHE", cache_dir)
    fake = _FakeDatalabClient()
    monkeypatch.setattr(extractor, "_client", lambda: fake)
    pdf = tmp_path / "doc.pdf"
    pdf.write_bytes(b"%PDF-1.4 fake contract bytes")

    data = extractor._raw_ocr(pdf, want_markdown=True, cache=False)

    assert data["markdown"] == "hello world"
    assert fake.ocr_calls == 1 and fake.convert_calls == 1
    assert not cache_dir.exists()          # no .ocr_cache dir ever created, let alone a file in it


def test_raw_ocr_cache_true_default_still_writes_and_reuses_cache(tmp_path, monkeypatch):
    """Corpus/sample prep (default cache=True) must keep caching for speed/cost."""
    cache_dir = tmp_path / ".ocr_cache"
    monkeypatch.setattr(extractor, "_CACHE", cache_dir)
    fake = _FakeDatalabClient()
    monkeypatch.setattr(extractor, "_client", lambda: fake)
    pdf = tmp_path / "doc.pdf"
    pdf.write_bytes(b"%PDF-1.4 fake contract bytes")

    first = extractor._raw_ocr(pdf, want_markdown=True, cache=True)
    assert fake.ocr_calls == 1
    cache_files = list(cache_dir.glob("*.json"))
    assert len(cache_files) == 1

    second = extractor._raw_ocr(pdf, want_markdown=True, cache=True)
    assert fake.ocr_calls == 1             # served from disk cache, no second Datalab call
    assert second == first
