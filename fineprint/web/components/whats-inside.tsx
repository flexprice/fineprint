import { data } from "@/lib/data";

// Hue per pill so the set reads as a calm palette rather than one flat grey block.
const DOC_TYPES: [string, number][] = [
  ["Order forms", 210],
  ["Master agreements", 262],
  ["Renewals & amendments", 158],
  ["Scanned / OCR-noisy", 28],
  ["Redlined drafts", 342],
  ["Multi-currency", 190],
];

type Spec = { icon: React.ReactNode; title: string; body: string };

const ICON = {
  doc: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M19 8v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7z" />
      <path d="M9 13h6" /><path d="M9 17h4" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  checklist: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M10 6h10" /><path d="M10 12h10" /><path d="M10 18h10" />
      <path d="m3 6 1.4 1.4L7.2 4.6" /><path d="m3 12 1.4 1.4L7.2 10.6" /><path d="m3 18 1.4 1.4L7.2 16.6" />
    </svg>
  ),
  split: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M4 4v5a4 4 0 0 0 4 4h12" /><path d="m16 9 4 4-4 4" />
      <path d="M4 20v-3" />
    </svg>
  ),
};

const SPECS: Spec[] = [
  { icon: ICON.doc, title: "Real documents", body: "Public contracts pulled off the web with the licenses checked. Some are scanned, some are redlined, and most are formatted badly enough to be realistic." },
  { icon: ICON.lock, title: "Private test set", body: "The answer key never leaves our machines, so no model can train on it. We publish how much we scored and keep the documents themselves." },
  { icon: ICON.checklist, title: "Field-level scoring", body: "Every fee, date, currency, entitlement and counterparty is judged on its own. $10k a quarter and $40k a year count as the same answer, because they are." },
  { icon: ICON.split, title: "Two scores, not one", body: "Economic facts are scored apart from house conventions, so a model that reads the money correctly but formats a cadence oddly is not marked like one that invented the number." },
];

export function WhatsInside() {
  return (
    <section id="inside" className="shell pt-24 pb-16">
      <p className="eyebrow mb-3">How we measure</p>
      <h2 className="display text-[clamp(1.9rem,4.2vw,2.6rem)] max-w-[20ch]">A private test set of real contracts.</h2>
      <p className="mt-5 text-[16px] leading-relaxed text-muted max-w-[62ch]">
        {data.n_contracts} real contracts, {data.fields_per_contract} billing fields in each. Every field is
        compared against a hand-labeled answer key that never ships.
      </p>

      <div className="mt-12 grid sm:grid-cols-2 gap-5">
        {SPECS.map((s) => (
          <div key={s.title} className="spec-card">
            <span className="spec-icon">{s.icon}</span>
            <div>
              <div className="text-[15.5px] font-medium tracking-[-.01em]">{s.title}</div>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{s.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Pills sit directly on the page. Boxing them inside another panel added a
          frame that carried no information. */}
      <div className="mt-14">
        <p className="eyebrow mb-4">Document types in the set</p>
        <div className="flex flex-wrap gap-2.5">
          {DOC_TYPES.map(([label, h]) => (
            <span key={label} className="pill" style={{ ["--h" as string]: h }}>{label}</span>
          ))}
        </div>
      </div>

      <p className="mt-10 text-[12.5px] text-faint">
        * A labeled seed set for now. We are working up to roughly 200 contracts across 6 industries and 4 currencies.
      </p>
    </section>
  );
}
