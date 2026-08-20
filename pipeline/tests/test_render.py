from pipeline.extractor import Document, Line
from pipeline.render import field_boxes

def _doc():
    d = Document(stem="x", path="x.pdf", page_dims=[[0, 0, 1000.0, 2000.0]])
    d.lines = [Line(line_id="x#p0#L1", doc="x", page=0, text="Fee", bbox=[100, 200, 300, 240], ocr_conf=1.0)]
    return d

def test_field_boxes_normalizes_against_page_dims():
    boxes = field_boxes(_doc(), ["x#p0#L1"])
    assert boxes == [{"page": 0, "box": [0.1, 0.1, 0.3, 0.12]}]

def test_field_boxes_skips_unknown_and_empty():
    assert field_boxes(_doc(), ["nope"]) == []
    assert field_boxes(_doc(), []) == []
