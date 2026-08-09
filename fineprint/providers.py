"""Model-agnostic call layer. One function -> (fields, usage, latency_s).

Runs against OpenAI directly or any model on OpenRouter (same OpenAI-compatible shape, different
base_url + key). Because the sweep spans ~40 models from 10 labs, the call is defensive: it routes
to the right model id, degrades gracefully when a provider does not support strict ``json_schema``
(falls back to ``json_object`` then to prompt-only JSON), and never sends reasoning controls to a
model that would reject them. Run modules from the repo root so ``pipeline`` / ``fineprint`` resolve.
"""
import json
import re
import time

from openai import OpenAI

from pipeline.reasoner import SYSTEM, _SCHEMA, FieldEnvelope
from fineprint.config import OPENAI_API_KEY, OPENROUTER_API_KEY

_CLIENTS: dict[str, OpenAI] = {}
_FIELD_KEYS = ("field", "value", "confidence", "line_ids", "reasoning", "doubt")

# A textual schema hint appended when a provider can't take a strict json_schema response_format.
_SCHEMA_HINT = (
    "Return ONLY a JSON object of this exact shape (no prose, no markdown fences):\n"
    '{"fields":[{"field":"<name>","value":<string|number|null>,"confidence":"HIGH|MEDIUM|LOW",'
    '"line_ids":[<int>],"reasoning":"<why>","doubt":<string|null>}],"open_items":[<string>]}'
)


def _client(provider: str) -> OpenAI:
    if provider not in _CLIENTS:
        if provider == "openrouter":
            _CLIENTS[provider] = OpenAI(
                api_key=OPENROUTER_API_KEY, base_url="https://openrouter.ai/api/v1",
                max_retries=3, timeout=360,
                default_headers={"HTTP-Referer": "https://fineprint.bench", "X-Title": "FinePrint"})
        else:
            _CLIENTS[provider] = OpenAI(api_key=OPENAI_API_KEY, max_retries=3, timeout=360)
    return _CLIENTS[provider]


def build_user(doc, rules: str) -> str:
    """Assemble the user prompt: extraction rules + numbered OCR lines + markdown context."""
    user = f"CLIENT/CUSTOMER EXTRACTION RULES (obey these):\n{rules}\n\n"
    user += f"NUMBERED OCR LINES:\n### DOCUMENT: {doc.stem}\n{doc.numbered_lines_text()}\n\n"
    if doc.markdown:
        user += f"STRUCTURED CONTEXT:\n### MARKDOWN: {doc.stem}\n{doc.markdown}\n"
    return user


def _extract_json(text: str) -> dict:
    """Pull the extraction object out of a raw completion — tolerant of ``` fences and stray prose."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        i, j = text.find("{"), text.rfind("}")
        if i != -1 and j > i:
            return json.loads(text[i:j + 1])
        raise


def _api_model(model: dict) -> str:
    """The id to send on the wire: the OpenRouter slug when routing through OpenRouter."""
    return model["openrouter_id"] if model.get("provider") == "openrouter" and model.get("openrouter_id") else model["id"]


def call(model: dict, user: str):
    """Run one extraction. Returns (fields, usage_dict, latency_s).

    Raises on hard API error or unparseable output — the caller records the failure so a single
    bad model never stalls the sweep.
    """
    client = _client(model.get("provider", "openai"))
    base = dict(model=_api_model(model),
                messages=[{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}])
    if model.get("effort"):
        base["reasoning_effort"] = model["effort"]

    # Try strict json_schema -> json_object -> prompt-only, so every provider gets its best shot.
    attempts = [
        {**base, "response_format": {"type": "json_schema", "json_schema": _SCHEMA}},
        {**base, "response_format": {"type": "json_object"},
         "messages": [base["messages"][0], {"role": "user", "content": user + "\n\n" + _SCHEMA_HINT}]},
        {**base, "messages": [base["messages"][0], {"role": "user", "content": user + "\n\n" + _SCHEMA_HINT}]},
    ]
    last_err: Exception | None = None
    t = time.time()
    for i, kw in enumerate(attempts):
        try:
            resp = client.chat.completions.create(**kw)
            latency = time.time() - t
            content = resp.choices[0].message.content or ""
            data = _extract_json(content)
            fields = [FieldEnvelope(**{k: f.get(k) for k in _FIELD_KEYS}) for f in data.get("fields", [])]
            if not fields:
                raise ValueError("no fields returned")
            u = resp.usage
            rd = getattr(u, "completion_tokens_details", None)
            usage = {"in": u.prompt_tokens, "out": u.completion_tokens,
                     "reasoning": getattr(rd, "reasoning_tokens", 0) if rd else 0}
            return fields, usage, latency
        except Exception as e:  # noqa: BLE001 — fall through to the next, less strict, attempt
            last_err = e
            if i == 0 and "reasoning_effort" in base:
                base.pop("reasoning_effort", None)  # a model that rejects effort won't take it on retry either
                for a in attempts[1:]:
                    a.pop("reasoning_effort", None)
    raise last_err  # type: ignore[misc]
