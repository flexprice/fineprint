"""A model that does not exist on its endpoint fails every call, and a model whose calls all fail
still publishes a row from the survivors. Preflight turns that into a list of names, before spend."""
from fineprint import preflight as PF


def _m(mid, brand, orid):
    return {"id": mid, "brand": brand, "provider": "openrouter", "openrouter_id": orid}


def test_flags_a_model_absent_from_the_route_it_will_be_called_on(monkeypatch):
    monkeypatch.setattr(PF, "_ids", lambda route: {"openai/gpt-5.5"})
    rows = PF.check([_m("gpt-5.5", "openai", "openai/gpt-5.5"),
                     _m("ghost-9", "openai", "openai/ghost-9")])
    assert [r["status"] for r in rows] == ["ok", "MISSING"]


def test_reports_unknown_rather_than_missing_when_the_catalogue_is_unreachable(monkeypatch):
    """No key or a down endpoint must not read as 'every model is broken' — that would send us
    chasing 56 phantom failures."""
    monkeypatch.setattr(PF, "_ids", lambda route: None)
    assert [r["status"] for r in PF.check([_m("gpt-5.5", "openai", "openai/gpt-5.5")])] == ["UNKNOWN"]


def test_checks_the_id_that_will_actually_go_on_the_wire_per_route(monkeypatch):
    """Direct routing sends the bare name, OpenRouter sends the slug — preflight must check
    whichever one this run will really send, not a fixed choice."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-a")
    # Anthropic's real catalogue hyphenates the version; OpenRouter's dots it.
    monkeypatch.setattr(PF, "_ids", lambda route: {"claude-fable-5-1"})
    m = _m("claude-fable-5.1", "anthropic", "anthropic/claude-fable-5.1")

    assert PF.check([m], direct=True)[0] == {"id": "claude-fable-5.1", "route": "anthropic",
                                             "wire": "claude-fable-5-1", "status": "ok"}
    # same model, default routing: sends the slug, which is NOT in this catalogue
    assert PF.check([m], direct=False)[0]["status"] == "MISSING"
