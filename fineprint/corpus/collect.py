"""Corpus collector — pulls real, public contracts from SEC EDGAR full-text search.

EDGAR exhibits (EX-10.x material agreements) are public filings and a rich source of the
billing-relevant contracts FinePrint scores: SaaS/order-form/license agreements with fees,
cadences, and commitments. This downloads a batch and writes a manifest; text-extraction and
hand-labeling are the next phase (see README).

    python3 -m fineprint.corpus.collect            # default target
    python3 -m fineprint.corpus.collect 200        # collect up to 200

The raw downloads + manifest are gitignored: the *specific* curated set + its labels are the
private holdout. Only aggregate results are ever published.
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request

from fineprint.config import HERE

UA = "FinePrint Benchmark (research@flexprice.io)"          # SEC requires a descriptive UA
FTS = "https://efts.sec.gov/LATEST/search-index?q="
CORPUS = HERE / "corpus"
RAW = CORPUS / "raw"
MANIFEST = CORPUS / "manifest.json"

# billing-relevant contract shapes — the documents whose fee/cadence/commitment terms we score
QUERIES = [
    '"master services agreement" "subscription fee"',
    '"order form" "platform fee"',
    '"software license agreement" "annual fee"',
    '"software as a service" "fees payable" "per annum"',
    '"saas" "subscription term" "fees"',
    '"statement of work" "monthly fee"',
]


def _get(url: str, tries: int = 3) -> bytes:
    for i in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30).read()
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(1.5)
    return b""


def _search(q: str, limit: int = 30) -> list:
    data = json.loads(_get(FTS + urllib.parse.quote(q)))
    return data.get("hits", {}).get("hits", [])[:limit]


def _doc_url(hit: dict) -> str:
    acc, fn = hit["_id"].split(":", 1)
    src = hit["_source"]
    cik = (src.get("ciks") or [None])[0]
    if not cik:
        m = re.search(r"CIK (\d+)", " ".join(src.get("display_names", [])))
        cik = m.group(1) if m else None
    return f"https://www.sec.gov/Archives/edgar/data/{str(cik).lstrip('0')}/{acc.replace('-', '')}/{fn}"


# ── CUAD / Atticus Project — CC BY 4.0, plain-text commercial contracts ───────
# 510 real commercial agreements (services, distributor, license, supply, hosting, ...) with
# real fee / payment / commitment terms — a license-clear complement to the EDGAR pull.
# Source: https://www.atticusprojectai.org/cuad  (mirrored on the HuggingFace hub below).
CUAD_REPO = "theatticusproject/cuad"
CUAD_TREE = f"https://huggingface.co/api/datasets/{CUAD_REPO}/tree/main/CUAD_v1/full_contract_txt?recursive=true"
CUAD_RAW = f"https://huggingface.co/datasets/{CUAD_REPO}/resolve/main/"
# contract types whose terms actually carry the fees / cadences / commitments FinePrint scores
CUAD_BILLING = ("service", "distributor", "license", "supply", "reseller", "hosting",
                "maintenance", "sponsorship", "franchise", "agency", "manufacturing",
                "development", "endorsement")


def _cuad_meta(name: str) -> dict:
    """Best-effort (company, date, type) from a CUAD filename — three naming formats appear."""
    stem = name[:-4] if name.endswith(".txt") else name
    date = None
    m = re.search(r"_(\d{4})(\d{2})(\d{2})_", stem)              # Co_20200205_8-K_EX-10.3_...
    if m:
        date, company = f"{m.group(1)}-{m.group(2)}-{m.group(3)}", stem[:m.start()]
    elif (m := re.match(r"(.+?)_(\d{2})_(\d{2})_(\d{4})-", stem)):  # CO_06_15_2020-EX-4.25-...
        date, company = f"{m.group(4)}-{m.group(2)}-{m.group(3)}", m.group(1)
    else:
        company = re.split(r" - |_", stem, maxsplit=1)[0]        # "Antares Pharma, Inc. - ..."
    t = re.search(r"([A-Za-z][A-Za-z ]*agreement)", stem, re.I)
    return {"company": company.strip(), "date": date, "type": t.group(1).title() if t else None}


def collect_cuad(target: int = 8) -> None:
    """Proof-of-concept pull from CUAD into the same corpus/ + manifest (billing-type contracts)."""
    RAW.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else []
    seen = {m["id"] for m in manifest}
    paths = [t["path"] for t in json.loads(_get(CUAD_TREE))
             if t.get("type") == "file" and t["path"].endswith(".txt")]
    paths = [p for p in paths if any(k in p.lower() for k in CUAD_BILLING)]
    added = 0
    print(f"CUAD: {len(paths)} billing-type contracts available; pulling up to {target} ...", flush=True)
    for p in paths:
        if added >= target:
            break
        hid = "cuad:" + p.rsplit("/", 1)[-1]
        if hid in seen:
            continue
        try:
            txt = _get(CUAD_RAW + urllib.parse.quote(p))
            meta = _cuad_meta(p.rsplit("/", 1)[-1])
            name = "cuad_" + re.sub(r"[^A-Za-z0-9]+", "_", p.rsplit("/", 1)[-1])[:60] + ".txt"
            (RAW / name).write_bytes(txt)
            manifest.append({
                "id": hid, "file": name, "source": "cuad",
                "company": meta["company"], "date": meta["date"], "form": meta["type"],
                "query": "cuad:CC-BY-4.0", "kb": round(len(txt) / 1024),
            })
            seen.add(hid)
            MANIFEST.write_text(json.dumps(manifest, indent=1))
            added += 1
            print(f"  [{len(manifest)}] {meta['company'][:36]:36} {round(len(txt)/1024)}KB", flush=True)
            time.sleep(0.4)   # HuggingFace politeness
        except Exception as e:  # noqa: BLE001
            print(f"  skip {hid}: {str(e)[:60]}", flush=True)
    print(f"\ndone — +{added} CUAD contracts ({len(manifest)} total) in {RAW}", flush=True)


def collect(target: int = 40) -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else []
    seen = {m["id"] for m in manifest}
    print(f"collecting up to {target} contracts (have {len(manifest)}) ...", flush=True)
    for q in QUERIES:
        if len(manifest) >= target:
            break
        for hit in _search(q):
            if len(manifest) >= target:
                break
            hid = hit["_id"]
            if hid in seen:
                continue
            try:
                html = _get(_doc_url(hit))
                name = re.sub(r"[^A-Za-z0-9]+", "_", hid)[:60] + ".html"
                (RAW / name).write_bytes(html)
                src = hit["_source"]
                manifest.append({
                    "id": hid, "file": name,
                    "company": (src.get("display_names") or ["?"])[0],
                    "date": src.get("file_date"), "form": src.get("root_forms", src.get("file_type")),
                    "query": q, "kb": round(len(html) / 1024),
                })
                seen.add(hid)
                MANIFEST.write_text(json.dumps(manifest, indent=1))
                print(f"  [{len(manifest)}] {(src.get('display_names') or ['?'])[0][:36]:36} {round(len(html)/1024)}KB", flush=True)
                time.sleep(0.4)   # SEC fair-access politeness
            except Exception as e:  # noqa: BLE001
                print(f"  skip {hid}: {str(e)[:60]}", flush=True)
    print(f"\ndone — {len(manifest)} contracts in {RAW}", flush=True)


if __name__ == "__main__":
    args = sys.argv[1:]
    if args and args[0] == "cuad":                    # python -m fineprint.corpus.collect cuad 8
        collect_cuad(int(args[1]) if len(args) > 1 else 8)
    else:                                             # python -m fineprint.corpus.collect 200
        collect(int(args[0]) if args else 40)
