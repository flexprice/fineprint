"""OpenRouter is the pricing source of truth.

Fetches the public model catalogue and writes per-model USD/1M token pricing to
``data/pricing.json``, keyed by our model id. Re-run whenever prices move:

    python3 -m fineprint.pricing
"""
import json
import urllib.request

from fineprint.config import all_models, HERE

_URL = "https://openrouter.ai/api/v1/models"
CACHE = HERE / "data" / "pricing.json"


def refresh() -> dict:
    catalog = {m["id"]: m for m in json.load(urllib.request.urlopen(_URL, timeout=30))["data"]}
    out = {}
    for m in all_models():
        orid = m.get("openrouter_id")
        entry = catalog.get(orid) if orid else None
        if entry:
            p = entry["pricing"]
            out[m["id"]] = {"price_in": round(float(p["prompt"]) * 1e6, 4),
                            "price_out": round(float(p["completion"]) * 1e6, 4),
                            "source": "openrouter"}
        else:
            out[m["id"]] = {"price_in": m["price_in"], "price_out": m["price_out"], "source": "config"}
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(out, indent=2))
    print(f"wrote {CACHE}")
    for mid, p in out.items():
        print(f"  {mid:16} ${p['price_in']}/${p['price_out']} per 1M  ({p['source']})")
    return out


def load() -> dict:
    """Cached pricing keyed by model id; empty dict if not yet fetched."""
    return json.loads(CACHE.read_text()) if CACHE.exists() else {}


if __name__ == "__main__":
    refresh()
