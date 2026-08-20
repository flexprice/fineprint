from types import SimpleNamespace
from pipeline.extractor import Document, Line
from fineprint.playground import extract_result

def _doc():
    d = Document(stem="x", path="x.pdf", page_dims=[[0, 0, 1000.0, 2000.0]])
    d.lines = [Line(line_id="x#p0#L1", doc="x", page=0, text="Fee", bbox=[100, 200, 300, 240], ocr_conf=1.0)]
    return d

def _fe(field, value, cat, line_ids):
    return SimpleNamespace(field=field, value=value, confidence="HIGH", line_ids=line_ids, category=cat)

def test_extract_result_shapes_fields_and_boxes():
    fake_call = lambda model, user: ([_fe("recurring_fee.amount", "10000", "Recurring Fee", ["x#p0#L1"])],
                                     {"in": 5, "out": 2}, 1.5)
    r = extract_result(_doc(), {"id": "m", "label": "M"}, call_fn=fake_call)
    assert r["model"] == "M" and r["latency"] == 1.5 and r["in"] == 5
    f = r["fields"][0]
    assert f["field"] == "recurring_fee.amount" and f["category"] == "Recurring Fee"
    assert f["boxes"] == [{"page": 0, "box": [0.1, 0.1, 0.3, 0.12]}]

def test_extract_result_field_without_citation_has_no_box():
    fake_call = lambda model, user: ([_fe("payment_terms", "Net 30", "Payment", [])], {"in": 1, "out": 1}, 0.4)
    r = extract_result(_doc(), {"id": "m", "label": "M"}, call_fn=fake_call)
    assert r["fields"][0]["boxes"] == []
