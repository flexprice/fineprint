"""Check every model resolves on the route it will actually be called through — before spending.

A model id that does not exist on its endpoint fails every call, and a model whose calls all fail
still publishes a row from whatever handful survived. That is how a flagship landed at rank #30 off
2 successful calls out of 174. One cheap catalogue lookup per route turns that into a list of names
to fix, printed before a cent is spent.

    python -m fineprint.preflight              # everything via OpenRouter (the steady state)
    python -m fineprint.preflight --direct     # the one-time re-baseline routing
"""
import argparse
import json
import os
import urllib.error
import urllib.request

from fineprint.config import all_models
from fineprint.providers import _DIRECT_LABS, _api_model, route_for

_CATALOGUE = {
    "openrouter": ("https://openrouter.ai/api/v1/models", "OPENROUTER_API_KEY"),
    "openai":     ("https://api.openai.com/v1/models", "OPENAI_API_KEY"),
    "anthropic":  ("https://api.anthropic.com/v1/models", "ANTHROPIC_API_KEY"),
    "google":     ("https://generativelanguage.googleapis.com/v1beta/openai/models", "GEMINI_API_KEY"),
}


def _ids(route: str) -> set[str] | None:
    """Model ids a route serves. None means we could not ask (no key / endpoint unreachable) —
    reported as UNKNOWN rather than silently treated as 'model missing'."""
    url, env = _CATALOGUE[route]
    key = os.environ.get(env, "").strip()
    req = urllib.request.Request(url)
    if key and route == "anthropic":
        # Anthropic's catalogue is native-API, not the OpenAI-compatible surface: it authenticates
        # with x-api-key and requires a version header. A Bearer token here silently 401s, which
        # reads as UNKNOWN and hides whether the model ids are real.
        req.add_header("x-api-key", key)
        req.add_header("anthropic-version", "2023-06-01")
    elif key:
        req.add_header("Authorization", f"Bearer {key}")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = json.load(r)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return None
    rows = body.get("data", body.get("models", []))
    out = set()
    for m in rows:
        mid = m.get("id") or m.get("name") or ""
        out.add(mid.split("/")[-1] if route == "google" else mid)
    return out or None


def check(models: list[dict], direct: bool = False) -> list[dict]:
    """One row per model: the route it will use, the id it will send, and whether that id exists."""
    catalogues: dict[str, set[str] | None] = {}
    out = []
    for m in models:
        route = route_for(m, direct)
        if route not in catalogues:
            catalogues[route] = _ids(route)
        wire, known = _api_model(m, route), catalogues[route]
        status = "UNKNOWN" if known is None else ("ok" if wire in known else "MISSING")
        out.append({"id": m["id"], "route": route, "wire": wire, "status": status})
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="Verify every model resolves before a sweep.")
    ap.add_argument("--direct", action="store_true", help="one-time first-party direct routing")
    ap.add_argument("--models", nargs="*", help="ids to check (default: the whole catalog)")
    args = ap.parse_args()

    universe = all_models()
    if args.models:
        universe = [m for m in universe if m["id"] in set(args.models)]
    rows = check(universe, args.direct)

    if args.direct:
        have = [b for b, (env, _) in _DIRECT_LABS.items() if os.environ.get(env, "").strip()]
        print(f"direct keys present: {', '.join(have) or 'none'}\n")
    by_route: dict[str, list[dict]] = {}
    for r in rows:
        by_route.setdefault(r["route"], []).append(r)
    for route, rs in sorted(by_route.items()):
        bad = [r for r in rs if r["status"] != "ok"]
        print(f"{route:<12} {len(rs):>3} models   {len(rs)-len(bad):>3} ok   {len(bad):>3} to fix")
        for r in bad:
            print(f"    {r['status']:<8} {r['id']:<30} sends {r['wire']!r}")
    broken = [r for r in rows if r["status"] == "MISSING"]
    print(f"\n{len(broken)} model(s) would fail every call." if broken else "\nall models resolve.")


if __name__ == "__main__":
    main()
