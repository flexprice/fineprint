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
import urllib.request

from openai import OpenAI

from pipeline.reasoner import SYSTEM, _SCHEMA, FieldEnvelope
from fineprint.config import OPENAI_API_KEY, OPENROUTER_API_KEY

_CLIENTS: dict[str, OpenAI] = {}
_FIELD_KEYS = ("field", "value", "confidence", "line_ids", "reasoning", "doubt")

_CATALOG_URL = "https://openrouter.ai/api/v1/models"
# Default reasoning_effort for auto-detected reasoning models that carry no explicit effort — heavy
# reasoners left uncapped burn the whole client timeout on a single doomed attempt. "low" keeps the
# call fast and the JSON complete. Applied at resolve time (fineprint.eval) so it is scoped to the
# auto-detected roster only — curated models keep their hand-tuned effort (and their deliberate None)
# untouched, which matters for a reproducible leaderboard.
DEFAULT_REASONING_EFFORT = "low"
# Safety cap on generated tokens for reasoning models so a pathological 32k-token reasoning run can't
# blow the wall-clock timeout. Generous — well above the ~few-thousand tokens this schema needs — so
# it bounds runaway without truncating a normal completion. Also set at resolve time.
REASONING_MAX_TOKENS = 16000

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


_CATALOG: dict | None = None
_CAPS: dict[str, set[str] | None] = {}


def _catalog() -> dict:
    """OpenRouter model catalog (public, unauthenticated), fetched once per process."""
    global _CATALOG
    if _CATALOG is None:
        try:
            with urllib.request.urlopen(_CATALOG_URL, timeout=30) as r:
                _CATALOG = {m["id"]: m for m in json.load(r)["data"]}
        except Exception:  # noqa: BLE001 — offline / catalog hiccup: fall back to "unknown"
            _CATALOG = {}
    return _CATALOG


def supported_params(model: dict) -> set[str] | None:
    """The model's OpenRouter ``supported_parameters`` as a set.

    Precedence: an explicit list on the model dict (wired in at resolve/register time) wins; else we
    probe the public catalog once and cache. Returns ``None`` when the capability set is unknown
    (non-OpenRouter model, missing id, or catalog unreachable) — callers then assume full support and
    keep the original try-everything behavior, so nothing regresses when the probe can't answer.
    """
    sp = model.get("supported_parameters")
    if sp is not None:
        return set(sp)
    if model.get("provider") != "openrouter":
        return None
    orid = model.get("openrouter_id")
    if not orid:
        return None
    if orid not in _CAPS:
        entry = _catalog().get(orid)
        _CAPS[orid] = set(entry["supported_parameters"]) if entry and entry.get("supported_parameters") else None
    return _CAPS[orid]


def _plan_attempts(base: dict, user: str, caps: set[str] | None) -> list[dict]:
    """Order the response-format attempts a model actually supports (strict → object → prompt).

    A model whose ``supported_parameters`` lacks ``structured_outputs`` can't honor a strict
    ``json_schema`` request — it silently returns ``{"fields":[]}``, wasting a whole (often very slow,
    for a reasoner) call before the fallback. Skip attempts the model can't do; when ``caps`` is
    unknown (None) keep the full try-everything ladder.
    """
    hint = {"role": "user", "content": user + "\n\n" + _SCHEMA_HINT}
    system = base["messages"][0]
    strict = {**base, "response_format": {"type": "json_schema", "json_schema": _SCHEMA}}
    json_obj = {**base, "response_format": {"type": "json_object"}, "messages": [system, hint]}
    prompt_only = {**base, "messages": [system, hint]}
    attempts = []
    if caps is None or "structured_outputs" in caps:
        attempts.append(strict)
    if caps is None or "response_format" in caps:
        attempts.append(json_obj)
    attempts.append(prompt_only)  # prompt-only always available as the last resort
    return attempts


def call(model: dict, user: str):
    """Run one extraction. Returns (fields, usage_dict, latency_s).

    Raises on hard API error or unparseable output — the caller records the failure so a single
    bad model never stalls the sweep.
    """
    client = _client(model.get("provider", "openai"))
    caps = supported_params(model)
    base = dict(model=_api_model(model),
                messages=[{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}])

    # Send reasoning controls only when the model actually carries them (curated effort, or the
    # conservative effort + token cap that fineprint.eval wires onto auto-detected reasoners) AND the
    # provider advertises the parameter — so we never trip a 400 on a model that rejects it.
    if model.get("effort") and (caps is None or "reasoning_effort" in caps):
        base["reasoning_effort"] = model["effort"]
    if model.get("max_tokens") and (caps is None or "max_tokens" in caps):
        base["max_tokens"] = model["max_tokens"]

    # Strict json_schema -> json_object -> prompt-only, but only the attempts this model supports, so
    # attempt-1 isn't a guaranteed-empty (and, for a slow reasoner, timeout-burning) call.
    attempts = _plan_attempts(base, user, caps)
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
            # A provider that rejects reasoning controls on one attempt will reject them on the next,
            # so strip them from every remaining attempt before retrying.
            for a in attempts[i + 1:]:
                a.pop("reasoning_effort", None)
                a.pop("max_tokens", None)
    raise last_err  # type: ignore[misc]
