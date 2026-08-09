import { data } from "@/lib/data";

const DOC_TYPES = ["Order forms", "Master agreements", "Renewals & amendments", "Scanned / OCR-noisy", "Redlined drafts", "Multi-currency"];

const SPECS: [string, string][] = [
  ["Real documents", "Public, license-clear contracts from the web — the messy PDFs businesses actually run on. Never synthetic."],
  ["Private test set", "Ground-truth labels stay internal, so no model can train on the answers. We publish the volume, never the data."],
  ["Field-level scoring", "Every fee, cadence, currency, entitlement and party is checked. Economic-equivalence aware: $10k/qtr = $40k/yr."],
  ["Repeated runs", `Every model runs each contract ${data.n_runs}×. We report mean accuracy and run-to-run σ — one shot hides nondeterminism.`],
];

export function WhatsInside() {
  const stats: [string, string][] = [
    [`${data.n_contracts}`, "contracts in this seed"],
    [`${data.fields_per_contract}`, "labeled fields / contract"],
    [data.total_judgments.toLocaleString(), "field judgments scored"],
    [`${data.n_runs}`, "runs per contract"],
  ];
  return (
    <section id="inside" className="mx-auto max-w-6xl px-5 py-8">
      <p className="eyebrow mb-3">What&rsquo;s inside</p>
      <h2 className="display text-[clamp(1.6rem,3.6vw,2.2rem)] max-w-[20ch]">A private test set of real contracts.</h2>
      <p className="mt-4 text-muted max-w-[58ch]">
        Most benchmarks test trivia. FinePrint tests whether a model can take a real, messy contract and
        return correct, structured billing data — the task that actually breaks in production.
      </p>

      <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {SPECS.map(([t, d]) => (
          <div key={t} className="grainient rounded-xl p-5 shadow-[var(--shadow-card)]">
            <div className="font-mono text-[11px] uppercase tracking-[.08em] mb-2" style={{ color: "rgba(255,255,255,.7)" }}>{t}</div>
            <p className="text-[13.5px] leading-relaxed" style={{ color: "rgba(255,255,255,.92)" }}>{d}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 panel rounded-xl px-6 py-5 flex flex-wrap items-center gap-x-10 gap-y-5 justify-between">
        <div className="flex flex-wrap gap-x-10 gap-y-4">
          {stats.map(([v, k]) => (
            <div key={k}>
              <div className="font-mono text-[21px] font-semibold tnum">{v}</div>
              <div className="text-[12px] text-faint mt-0.5">{k}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 max-w-[440px]">
          {DOC_TYPES.map((d) => (
            <span key={d} className="badge">{d}</span>
          ))}
        </div>
      </div>
      <p className="mt-3 font-mono text-[11px] text-faint">
        Seed benchmark shown on a labeled subset · scaling to ~200 web-sourced contracts across 6 industries and 4 currencies.
      </p>
    </section>
  );
}
