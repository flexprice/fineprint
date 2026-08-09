"""Stage ②: GPT-5.5 (medium) reasoning over the OCR lines.

Given a customer's numbered OCR lines (+ structured markdown context) and the
resolved per-client/customer override rules, GPT-5.5 fills the contract-value
schema, assigns a confidence enum, writes doubts, and cites the line_id(s) it
used per field (which drives annotation — no hallucinated coordinates).
"""
from __future__ import annotations
import json
from dataclasses import dataclass, asdict
from typing import List, Optional

from openai import OpenAI

from .config import OPENAI_API_KEY, REASONER_MODEL, REASONER_EFFORT
from .extractor import Document

# Contract-value fields (§6.1 of the design). value is a string; mapper coerces types.
FIELD_NAMES = [
    "start_date", "usage_plan_class", "currency",
    "platform_fee.amount", "platform_fee.frequency", "platform_fee.timing",
    "hosting_fee.amount", "hosting_fee.frequency", "hosting_fee.timing",
    "llm_usage_fee.amount", "llm_usage_fee.frequency", "llm_usage_fee.timing",
    "credit_grant.amount", "credit_grant.type",
    "entitlement.description", "entitlement.quantity", "entitlement.unit", "entitlement.period",
    "override_hosting_per_min", "override_sms_per_msg", "override_other",
    "commitment.amount", "commitment.period", "commitment.overage_factor",
    "commitment.true_up", "commitment.scope_notes",
    "payment_terms", "contract_value", "effective_contract_value", "pilot_fee",
    "customer.name", "customer.email",
    "customer.address_line1", "customer.address_line2", "customer.address_city",
    "customer.address_state", "customer.address_postal_code", "customer.address_country",
]
CATEGORIES = ["Identity", "Customer", "Platform Fee", "Hosting", "LLM Usage", "Credit Grant",
              "Entitlement", "Override", "Commitment", "Terms", "Other"]

_FIELD_CATEGORY = {
    "start_date": "Identity", "usage_plan_class": "Identity", "currency": "Identity",
    "contract_value": "Identity", "effective_contract_value": "Identity", "pilot_fee": "Identity",
    "customer": "Customer",
    "platform_fee": "Platform Fee", "hosting_fee": "Hosting", "llm_usage_fee": "LLM Usage",
    "credit_grant": "Credit Grant", "entitlement": "Entitlement",
    "override_hosting_per_min": "Hosting", "override_sms_per_msg": "Override", "override_other": "Override",
    "commitment": "Commitment", "payment_terms": "Terms",
}


@dataclass
class FieldEnvelope:
    field: str
    value: Optional[str]
    confidence: str                 # HIGH | NEEDS_REVIEW | MISSING
    line_ids: List[str]
    reasoning: str = ""
    doubt: Optional[str] = None

    @property
    def category(self) -> str:
        return _FIELD_CATEGORY.get(self.field.split(".")[0], "Other")

    @property
    def subcategory(self) -> str:
        return self.field


_SCHEMA = {
    "name": "contract_extraction", "strict": True,
    "schema": {
        "type": "object", "additionalProperties": False,
        "properties": {
            "fields": {
                "type": "array",
                "items": {
                    "type": "object", "additionalProperties": False,
                    "properties": {
                        "field": {"type": "string", "enum": FIELD_NAMES},
                        "value": {"type": ["string", "null"]},
                        "confidence": {"type": "string", "enum": ["HIGH", "NEEDS_REVIEW", "MISSING"]},
                        "line_ids": {"type": "array", "items": {"type": "string"}},
                        "reasoning": {"type": "string"},
                        "doubt": {"type": ["string", "null"]},
                    },
                    "required": ["field", "value", "confidence", "line_ids", "reasoning", "doubt"],
                },
            },
            "open_items": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["fields", "open_items"],
    },
}

SYSTEM = """You extract enterprise-contract billing terms into a fixed billing schema.
You are given a customer's contract document(s) as NUMBERED OCR LINES (id: text) plus a structured
markdown view. Reason carefully and fill every field you can.

Rules:
- For each field, cite the exact line_id(s) you used as evidence in `line_ids`. Only cite lines that
  literally support the value. If a value is COMPUTED/INFERRED from several lines, cite all of them.
- confidence: HIGH = directly and unambiguously stated in one place. NEEDS_REVIEW = inferred, computed,
  conflicting across documents, or you had to assume something (also write a `doubt`). MISSING = not
  present in the contract (value = null, line_ids = []).
- Decompose fees stated as totals+installments (e.g. "$240,000 payable in 4 quarterly installments"
  -> amount 60000, frequency Quarterly). frequency ∈ {Monthly,Quarterly,Half Yearly,Annual};
  timing ∈ {Advanced,Arrear,N/A}.
- override_hosting_per_min is a PER-MINUTE hosting rate (distinct from committed bank amounts).
- commitment.overage_factor is the overage multiplier (e.g. 1.5). commitment.amount is the minimum
  committed spend; if multiple order forms aggregate, use the combined figure and set NEEDS_REVIEW with a doubt.
- usage_plan_class ∈ {full_stack, platform_only, models_only}: full_stack if fees cover the platform plus
  downstream usage/model providers; platform_only if only the platform layer; models_only if only providers.
- currency: the ISO code for ALL monetary amounts in this contract (e.g. USD, INR, EUR, GBP). Infer from the
  symbol/words: `$`/US$/USD -> USD, `₹`/INR/Rs -> INR, `€`/EUR -> EUR, `£`/GBP -> GBP. If amounts use `$` with
  no country stated, default USD. One currency per contract; MISSING only if there are no monetary amounts.
- entitlement.description must be the CONCISE quantity only (e.g. "800,000 minutes"), not a paragraph.
  Put any extra tiers/conditions in override_other; keep scope_notes to one short clause.
- entitlement.quantity + entitlement.unit: the included/committed amount split into a plain number and its unit,
  e.g. "240,000 API calls" -> quantity `240000`, unit `API calls`; "500 GB" -> `500` + `GB`; "10 users" ->
  `10` + `users`; "45 minutes"/"800,000 minutes" -> quantity + `minutes`. quantity is digits only (no commas);
  unit is the bare unit noun. MISSING when no quantified entitlement is stated.
- customer.* is the COUNTERPARTY to the Vendor — the customer/licensee, NEVER the vendor itself. Identify it
  from the preamble ("...between <Vendor>, Inc. ... and <Customer>, a <state> corporation") or "Customer:" label.
  - customer.name: the customer's full legal entity name (e.g. "Acme Corp."). Do NOT return the vendor's name.
  - customer.email: the customer's billing/finance/AP contact email; else its primary/sponsor contact email.
    Use the customer's own domain, never the vendor's domain.
  - Parse the customer's physical address into parts: address_line1 (street), address_line2 (suite/floor/unit,
    else MISSING), address_city, address_state (2-letter US state when applicable), address_postal_code.
    address_country: use the stated country; if a US state/ZIP is present but country is unstated, infer "US"
    and mark NEEDS_REVIEW. Any part not present is MISSING.
- Amounts as plain numbers (no $ or commas). Never invent values; when unsure, MISSING or NEEDS_REVIEW + doubt."""


def _client() -> OpenAI:
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY missing from .env")
    # generous retries/timeout so batched, high-concurrency eval survives 429s
    return OpenAI(api_key=OPENAI_API_KEY, max_retries=6, timeout=240.0)


def reason_ex(docs: List[Document], override_rules: str = "",
              model: Optional[str] = None, effort: Optional[str] = None):
    """Core reasoning call. Returns (fields, usage) where usage is a dict with
    prompt/completion/reasoning/total token counts. `model`/`effort` default to config
    (prod path); benchmarks override them to compare models on identical input."""
    substrate = "\n\n".join(f"### DOCUMENT: {d.stem}\n{d.numbered_lines_text()}" for d in docs)
    context = "\n\n".join(f"### MARKDOWN: {d.stem}\n{d.markdown}" for d in docs if d.markdown)
    user = ""
    if override_rules.strip():
        user += f"CLIENT/CUSTOMER EXTRACTION RULES (obey these):\n{override_rules}\n\n"
    user += f"NUMBERED OCR LINES:\n{substrate}\n\n"
    if context:
        user += f"STRUCTURED CONTEXT:\n{context}\n"

    resp = _client().chat.completions.create(
        model=model or REASONER_MODEL,
        reasoning_effort=effort or REASONER_EFFORT,
        messages=[{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}],
        response_format={"type": "json_schema", "json_schema": _SCHEMA},
    )
    data = json.loads(resp.choices[0].message.content)
    out = [FieldEnvelope(**{k: f.get(k) for k in ("field", "value", "confidence", "line_ids", "reasoning", "doubt")})
           for f in data["fields"]]
    u = resp.usage
    ctd = getattr(u, "completion_tokens_details", None)
    usage = {"prompt": u.prompt_tokens, "completion": u.completion_tokens,
             "reasoning": getattr(ctd, "reasoning_tokens", 0) or 0, "total": u.total_tokens}
    return out, usage


def reason(docs: List[Document], override_rules: str = "") -> List[FieldEnvelope]:
    return reason_ex(docs, override_rules)[0]


def to_json(fields: List[FieldEnvelope]) -> list:
    return [asdict(f) | {"category": f.category} for f in fields]
