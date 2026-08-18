"""FinePrint benchmark configuration.

Paths resolve relative to the repo, so the package is portable. The contract corpus and
ground-truth labels are PRIVATE (gitignored): the open-source harness runs against your own
labeled data, and only anonymized aggregate results are ever published. Override any path or
run parameter via the ``FINEPRINT_*`` environment variables.

Every model runs through OpenRouter (one key, one shape). The registry below is the curated
roster; any model not listed can still be evaluated ad-hoc by passing its OpenRouter id to
``fineprint.eval`` — it is resolved live and appended to ``roster.json`` so it joins the site.
"""
import json
import os
from pathlib import Path

from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
load_dotenv(REPO / ".env")

# ── run parameters ──────────────────────────────────────────────────────────
N_RUNS = int(os.environ.get("FINEPRINT_N_RUNS", "5"))        # runs per (model, contract) — captures nondeterminism
MAX_WORKERS = int(os.environ.get("FINEPRINT_WORKERS", "6"))

# ── paths (private data is gitignored; bring your own via env) ──────────────
OCR_DIR = Path(os.environ.get("FINEPRINT_OCR_DIR", HERE / "data" / "ocr"))
RESULTS = Path(os.environ.get("FINEPRINT_RESULTS", HERE / "results" / "runs.json"))
AUDIT_DIR = HERE / "results" / "audit"                       # private per-field dumps (gitignored)
ROSTER_FILE = Path(os.environ.get("FINEPRINT_ROSTER", HERE / "roster.json"))   # ad-hoc models
OVERRIDES_DIR = REPO / "overrides"
GROUND_TRUTH = Path(os.environ.get(
    "FINEPRINT_GROUND_TRUTH", REPO / "data" / "ground_truth.xlsx"))   # bring your own labeled workbook
# Optional cleaned gold-label overrides (JSON {contract: {field: value}}); layered over the
# workbook. Produced by the ensemble+adjudication label-QA pass — corrects hand-label errors.
GOLD_LABELS = Path(os.environ["FINEPRINT_GOLD_LABELS"]) if os.environ.get("FINEPRINT_GOLD_LABELS") else None
WEB_DATA = Path(os.environ.get(                              # anonymized aggregates — published
    "FINEPRINT_WEB_DATA", HERE / "web" / "lib" / "data.json"))

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")

# ── seed contract set: (display label, corpus folder under OCR_DIR) ─────────
# Bring your own labeled contracts — folder names must match your OCR'd .pkl files and the
# ground-truth rows. Display labels are anonymized (Doc A, Doc B, …) before anything is published.
SEED_CONTRACTS = [
    ("Contract 1", "contract-1"),
    ("Contract 2", "contract-2"),
    ("Contract 3", "contract-3"),
    ("Contract 4", "contract-4"),
    ("Contract 5", "contract-5"),
    ("Contract 6", "contract-6"),
]

# Private deployments point FINEPRINT_SEED_CONTRACTS at a JSON file of [display, folder] pairs
# (kept in the private bucket, synced at boot — never in the repo) so real contract identities
# stay out of the public code. Display labels are still anonymized (Doc A…) before publishing.
_seed_override = os.environ.get("FINEPRINT_SEED_CONTRACTS")
if _seed_override and Path(_seed_override).exists():
    SEED_CONTRACTS = [tuple(x) for x in json.loads(Path(_seed_override).read_text())]

# ── lab → logo brand (see web/components/provider-icon.tsx) ──────────────────
BRAND = {
    "openai": "openai", "anthropic": "anthropic", "google": "google",
    "meta-llama": "meta", "mistralai": "mistral", "deepseek": "deepseek",
    "x-ai": "xai", "qwen": "qwen", "cohere": "cohere", "perplexity": "perplexity",
    "moonshotai": "moonshot", "z-ai": "zhipu", "amazon": "amazon",
    "minimax": "minimax", "nvidia": "nvidia",
}

# ── curated roster: 35 recent models across 10 labs, all via OpenRouter ──────
# (openrouter_id, label, family, price_in, price_out, effort|None, new)
# Prices (USD/1M) are fallbacks; the source of truth is OpenRouter (pricing.py). ``new`` marks
# this generation's headliners — drives the quadrant's colored points and the launch spotlight.
_CATALOG = [
    ("openai/gpt-5.6-luna",              "GPT-5.6 Luna",     "GPT-5.6",     0.10,  0.60,  "medium", True),
    ("openai/gpt-5.6-terra",             "GPT-5.6 Terra",    "GPT-5.6",     1.00,  6.00,  "medium", True),
    ("openai/gpt-5.6-sol",               "GPT-5.6 Sol",      "GPT-5.6",     5.00,  30.00, "medium", True),
    ("openai/gpt-5.5",                   "GPT-5.5",          "GPT-5.5",     5.00,  30.00, "medium", False),
    ("openai/gpt-5.4-mini",              "GPT-5.4 Mini",     "GPT-5.4",     0.75,  4.50,  "medium", False),
    ("openai/gpt-5.4-nano",              "GPT-5.4 Nano",     "GPT-5.4",     0.20,  1.25,  "medium", False),
    ("anthropic/claude-opus-5",          "Claude Opus 5",    "Claude 5",    5.00,  25.00, None,     True),
    ("anthropic/claude-sonnet-5",        "Claude Sonnet 5",  "Claude 5",    2.00,  10.00, None,     True),
    ("anthropic/claude-fable-5",         "Claude Fable 5",   "Claude 5",    10.00, 50.00, None,     True),
    ("anthropic/claude-opus-4.8",        "Claude Opus 4.8",  "Claude 4.8",  5.00,  25.00, None,     False),
    ("google/gemini-3.6-flash",          "Gemini 3.6 Flash", "Gemini 3",    1.50,  7.50,  None,     True),
    ("google/gemini-3.5-flash",          "Gemini 3.5 Flash", "Gemini 3",    1.50,  9.00,  None,     False),
    ("google/gemini-3.5-flash-lite",     "Gemini 3.5 Flash Lite", "Gemini 3", 0.30, 2.50, None,     True),
    ("meta-llama/llama-4-maverick",      "Llama 4 Maverick", "Llama 4",     0.20,  0.80,  None,     True),
    ("meta-llama/llama-4-scout",         "Llama 4 Scout",    "Llama 4",     0.10,  0.30,  None,     True),
    ("meta-llama/llama-3.3-70b-instruct", "Llama 3.3 70B",   "Llama 3",     0.10,  0.32,  None,     False),
    ("mistralai/mistral-medium-3-5",     "Mistral Medium 3.5", "Mistral",   1.50,  7.50,  None,     True),
    ("mistralai/mistral-large-2512",     "Mistral Large",    "Mistral",     0.50,  1.50,  None,     True),
    ("mistralai/mistral-small-2603",     "Mistral Small",    "Mistral",     0.15,  0.60,  None,     False),
    ("mistralai/ministral-14b-2512",     "Ministral 14B",    "Mistral",     0.20,  0.20,  None,     False),
    ("deepseek/deepseek-v4-pro",         "DeepSeek V4 Pro",  "DeepSeek V4", 0.435, 0.87,  None,     True),
    ("deepseek/deepseek-v4-flash",       "DeepSeek V4 Flash", "DeepSeek V4", 0.14, 0.28,  None,     True),
    ("deepseek/deepseek-v3.2",           "DeepSeek V3.2",    "DeepSeek V3", 0.269, 0.40,  None,     False),
    ("deepseek/deepseek-r1-0528",        "DeepSeek R1",      "DeepSeek R1", 0.50,  2.15,  None,     False),
    ("x-ai/grok-4.5",                    "Grok 4.5",         "Grok 4",      2.00,  6.00,  None,     True),
    ("x-ai/grok-4.3",                    "Grok 4.3",         "Grok 4",      1.25,  2.50,  None,     False),
    ("x-ai/grok-4.20",                   "Grok 4.20",        "Grok 4",      1.25,  2.50,  None,     False),
    ("qwen/qwen3.8-max",                 "Qwen3.8 Max",      "Qwen3",       2.00,  6.00,  None,     True),
    ("qwen/qwen3.7-max",                 "Qwen3.7 Max",      "Qwen3",       1.475, 4.425, None,     False),
    ("qwen/qwen3.7-plus",                "Qwen3.7 Plus",     "Qwen3",       0.32,  1.28,  None,     False),
    ("qwen/qwen3.7-flash",               "Qwen3.7 Flash",    "Qwen3",       0.03,  0.13,  None,     True),
    ("cohere/command-a",                 "Command A",        "Command",     2.50,  10.00, None,     True),
    ("cohere/command-r-plus-08-2024",    "Command R+",       "Command",     2.50,  10.00, None,     False),
    ("perplexity/sonar-pro",             "Sonar Pro",        "Sonar",       3.00,  15.00, None,     True),
    ("perplexity/sonar-reasoning-pro",   "Sonar Reasoning Pro", "Sonar",    2.00,  8.00,  None,     False),
    ("moonshotai/kimi-k3",               "Kimi K3",          "Kimi",        3.00,  15.00, None,     True),
    ("moonshotai/kimi-k2.6",             "Kimi K2.6",        "Kimi",        0.58,  2.44,  None,     True),
    ("z-ai/glm-5.2",                     "GLM-5.2",          "GLM",         0.07,  0.22,  None,     True),
    ("z-ai/glm-5.1",                     "GLM-5.1",          "GLM",         0.952, 2.992, None,     False),
    ("amazon/nova-premier-v1",           "Nova Premier",     "Nova",        2.50,  12.50, None,     True),
    ("amazon/nova-2-lite-v1",            "Nova 2 Lite",      "Nova",        0.30,  2.50,  None,     True),
    ("minimax/minimax-m3",               "MiniMax M3",       "MiniMax",     0.30,  1.20,  None,     True),
    ("nvidia/nemotron-3-super-120b-a12b", "Nemotron 3 Super", "Nemotron",   0.30,  0.90,  None,     True),
]


def _model(orid, label, family, price_in, price_out, effort, new) -> dict:
    return {
        "id": orid.split("/", 1)[1], "label": label, "family": family,
        "provider": "openrouter", "openrouter_id": orid,
        "brand": BRAND.get(orid.split("/", 1)[0], orid.split("/", 1)[0]),
        "price_in": price_in, "price_out": price_out, "effort": effort, "new": new,
    }


MODELS = [_model(*row) for row in _CATALOG]
BASELINE_ID = "gpt-5.5"          # reference point for the "vs baseline" delta on the site


def load_roster() -> list[dict]:
    """Ad-hoc models registered by `fineprint.eval` (deduped against the curated catalog by id)."""
    if not ROSTER_FILE.exists():
        return []
    return json.loads(ROSTER_FILE.read_text())


def register_model(m: dict) -> None:
    """Upsert an ad-hoc model into roster.json so it survives across runs and joins the site."""
    roster = [r for r in load_roster() if r["id"] != m["id"]]
    roster.append(m)
    ROSTER_FILE.write_text(json.dumps(roster, indent=2))


def all_models() -> list[dict]:
    """The full model universe: curated catalog + any ad-hoc models, curated winning on id clash."""
    seen = {m["id"] for m in MODELS}
    return MODELS + [r for r in load_roster() if r["id"] not in seen]
