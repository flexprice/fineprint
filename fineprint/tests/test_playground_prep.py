import fineprint.playground_prep as prep

def test_build_pages_json_encodes_data_uris(monkeypatch):
    monkeypatch.setattr(prep, "render_pages", lambda b: [{"png": b"\x89PNG", "w": 8, "h": 9}])
    pages = prep.build_pages_json(b"%PDF")
    assert pages[0]["w"] == 8 and pages[0]["image"].startswith("data:image/png;base64,")
