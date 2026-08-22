import Link from "next/link";
import type { Metadata } from "next";
import { data } from "@/lib/data";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How FinePrint measures models on contract extraction, the dataset, its complexities, the metrics, the field-level scoring rubric, contamination controls, and where it sits among real-world LLM benchmarks.",
};

/* ── small building blocks ─────────────────────────────────────────────────── */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow mb-3">{children}</p>;
}
function H2({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 mb-5">
      <span className="font-mono text-[13px] text-accent tnum">{n}</span>
      <h2 className="display text-[clamp(1.5rem,3.4vw,2rem)]">{children}</h2>
    </div>
  );
}
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="badge">{children}</span>;
}

const SCHEMA: [string, string[]][] = [
  ["Identity", ["start_date", "currency", "usage_plan_class", "contract_value"]],
  ["Platform fee", ["amount", "frequency", "timing"]],
  ["Hosting fee", ["amount", "frequency", "timing"]],
  ["Usage fee", ["amount", "frequency", "timing"]],
  ["Credit grant", ["amount", "type"]],
  ["Entitlement", ["quantity", "unit", "period"]],
  ["Commitment", ["amount", "period", "overage_factor", "true_up"]],
  ["Overrides", ["per-unit rates", "other"]],
  ["Customer", ["name", "email", "address"]],
];

const COMPLEXITY: [string, string][] = [
  ["Messy tables", "Fees split across multi-column pricing tables and schedules, not clean prose."],
  ["Installment math", "“$240k in 4 equal quarterly installments” becomes $60k/quarter. The model must decompose totals."],
  ["Economic equivalence", "The same price expressed as $10k/quarter or $40k/year, both must score as correct."],
  ["Ambiguous cadence", "Coverage period vs billing cadence vs term length, often conflated in the same sentence."],
  ["Redlines & edits", "Struck-through and replaced values where only the later, edited figure is active."],
  ["Multi-currency", "USD, INR, EUR, GBP, inferred from symbols/words, normalized per contract."],
  ["OCR noise", "Scanned and low-quality PDFs; the model reads imperfect text, like production."],
  ["Cross-document", "MSA + Order Form together, where the Order Form controls on conflict."],
];

const METRICS: [string, string, string][] = [
  ["Accuracy", "Σ correct ÷ Σ scored", "Share of scored fields the model gets right, aggregated across every contract and run, economic-equivalence aware."],
  ["Hallucination", "confident-wrong ÷ HIGH-conf", "Of the answers a model marked HIGH confidence, the share that were wrong. The metric that matters for a human-review pipeline."],
  ["Consistency (σ)", "std-dev across runs", "Run-to-run standard deviation of accuracy. Low σ = a trustworthy, repeatable result; high σ = a coin flip on hard contracts."],
  ["Cost / 1k", "tokens × price", "Measured input/output tokens times published per-token pricing, projected to 1,000 contracts."],
  ["Latency", "p50 / p90 wall-clock", "Median and tail request time, the difference between a real-time and a batch workflow."],
  ["Value", "accuracy ÷ ($/1k)", "Accuracy points bought per dollar. Surfaces the cheap-and-good models the headline rank hides."],
];

const LANDSCAPE: [string, string, string][] = [
  ["Real-world task", "SWE-bench, τ-bench", "Not trivia, an actual job (resolve a GitHub issue; here, turn a contract into billing data)."],
  ["Multi-metric", "HELM", "Accuracy is necessary but not sufficient; we report cost, latency, calibration and consistency together."],
  ["Private holdout", "GPQA, SEAL", "Labels are held back so results resist training-set contamination and gaming."],
  ["Domain-specific", "LegalBench, FinBen", "A vertical the general benchmarks don’t cover: commercial contract into billing terms, for finance & ops."],
];

export default function Methodology() {
  return (
    <div className="shell py-14">
      {/* hero */}
      <Eyebrow>Methodology &amp; transparency</Eyebrow>
      <h1 className="display text-[clamp(2.2rem,5.5vw,3.4rem)] max-w-[18ch]">How FinePrint measures a model.</h1>
      <p className="mt-5 text-[17px] text-muted leading-relaxed max-w-[64ch]">
        FinePrint scores one task: turning a messy commercial contract into correct, structured billing
        data. This page covers what we test, how a field is judged correct, and where the benchmark
        falls short.
      </p>

      {/* 01, why it matters */}
      <section className="mt-16">
        <H2 n="01">Why this task matters</H2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card rounded-xl p-6">
            <div className="font-mono text-[11px] uppercase tracking-[.08em] text-faint mb-2">The enterprise world</div>
            <p className="text-[14.5px] text-muted leading-relaxed">
              Every company runs on contracts, and turning them into structured data is still overwhelmingly
              manual, slow, expensive, and error-prone at volume. World Commerce &amp; Contracting estimates poor
              contract management costs organizations roughly <b className="text-text">9% of annual revenue</b>,
              with a single basic contract taking ~$6,900 to process. It is the canonical document-AI problem:
              unstructured, high-stakes text in, reliable structured records out.
            </p>
          </div>
          <div className="card rounded-xl p-6">
            <div className="font-mono text-[11px] uppercase tracking-[.08em] text-faint mb-2">The finance &amp; billing world</div>
            <p className="text-[14.5px] text-muted leading-relaxed">
              Contract-to-cash lives or dies on these exact fields. Under <b className="text-text">ASC 606 / IFRS 15</b>,
              the contract itself is the legal basis for recognized revenue, so a misread fee, cadence, or
              commitment becomes a mis-invoice, a revenue-recognition error, or an audit finding. As usage-based
              and hybrid pricing spread (~45% of SaaS companies now bill on some usage model), the terms get more
              intricate. This is the task Flexprice automates in production; FinePrint measures who’s ready.
            </p>
          </div>
        </div>
      </section>

      {/* 02, the task */}
      <section className="mt-16">
        <H2 n="02">The task</H2>
        <p className="text-[15px] text-muted leading-relaxed max-w-[64ch] mb-6">
          A model receives a real contract as numbered OCR lines plus a structured markdown view, and
          returns a fixed billing schema as strict JSON, citing the source line for every field. This is
          the same task Flexprice runs in production.
        </p>
        {/* pipeline */}
        <div className="panel rounded-2xl p-5 sm:p-7 overflow-x-auto">
          <div className="flex items-stretch gap-3 min-w-[640px] font-mono text-[12px]">
            {[
              ["Contract PDF", "order form · MSA · renewal"],
              ["OCR lines", "numbered, cited-by-id"],
              ["Model", "structured extraction"],
              ["Billing schema", "strict JSON + confidence"],
              ["Field-level score", "vs private ground truth"],
            ].map(([t, s], i, a) => (
              <div key={t} className="flex items-center gap-3 flex-1">
                <div className="flex-1 rounded-xl border border-line-2 bg-surface px-4 py-4">
                  <div className="text-[13px] font-semibold text-text tracking-tight" style={{ fontFamily: "var(--font-sans)" }}>{t}</div>
                  <div className="text-faint mt-1">{s}</div>
                </div>
                {i < a.length - 1 && <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-line-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg>}
              </div>
            ))}
          </div>
        </div>
        {/* schema */}
        <div className="mt-4 panel rounded-2xl p-5 sm:p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
            <h3 className="text-[15px] font-semibold tracking-tight">The billing schema</h3>
            <span className="font-mono text-[11px] text-faint">~{data.fields_per_contract} hard-scored fields · free-text notes reviewed, not string-matched</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SCHEMA.map(([group, fields]) => (
              <div key={group}>
                <div className="font-mono text-[11px] uppercase tracking-[.06em] text-accent mb-2">{group}</div>
                <div className="flex flex-wrap gap-1.5">
                  {fields.map((f) => <Chip key={f}>{f}</Chip>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 03, the dataset */}
      <section className="mt-16">
        <H2 n="03">The dataset</H2>
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="card rounded-xl p-6">
            <div className="font-mono text-[11px] uppercase tracking-[.08em] text-faint mb-2">Provenance</div>
            <p className="text-[14.5px] text-muted leading-relaxed">
              Two sources, both real. A private set of executed commercial agreements, used under their
              own confidentiality terms and never republished, and material-agreement exhibits filed as
              public records on <b className="text-text">SEC EDGAR</b>. No synthetic documents: every
              contract was signed by real parties, and only the private set carries terms we cannot show.
            </p>
          </div>
          <div className="card rounded-xl p-6">
            <div className="font-mono text-[11px] uppercase tracking-[.08em] text-faint mb-2">Composition</div>
            <p className="text-[14.5px] text-muted leading-relaxed">
              Order forms, master service agreements, renewals and amendments, across industries and
              currencies, including scanned and redlined documents. The mix is chosen to mirror what an
              accounts-receivable or RevOps team actually sees, not the cleanest examples.
            </p>
          </div>
        </div>

        {/* complexity taxonomy */}
        <div className="panel rounded-2xl p-5 sm:p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
            <h3 className="text-[15px] font-semibold tracking-tight">Where the difficulty comes from</h3>
            <span className="font-mono text-[11px] text-faint">real-world complexity, not trick questions</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
            {COMPLEXITY.map(([t, d]) => (
              <div key={t} className="flex gap-3">
                <span className="mt-2 size-1.5 rounded-full shrink-0" style={{ background: "var(--accent)" }} />
                <div>
                  <div className="text-[14px] font-semibold tracking-tight">{t}</div>
                  <div className="text-[13.5px] text-muted leading-relaxed mt-0.5">{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* size / roadmap */}
        <div className="mt-4 grainient rounded-2xl px-7 py-6 shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[.08em] mb-1" style={{ color: "rgba(255,255,255,.7)" }}>Scale &amp; roadmap</div>
              <p className="text-[14.5px] leading-relaxed max-w-[58ch]" style={{ color: "rgba(255,255,255,.92)" }}>
                Scored results run on the <b>gold</b> set: contracts a human labeled field by field. The
                corpus grows through a two-tier scheme, a gold holdout for scoring plus a larger{" "}
                <b>silver</b> pool (independent strong-model drafts, kept only where they agree, with
                disagreements adjudicated by a human) for coverage. It is the standard way credible
                benchmarks scale labels without sacrificing trust, and we keep the tiers separate rather
                than reporting one blended figure.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 04, contamination controls */}
      <section className="mt-16">
        <H2 n="04">Kept honest &amp; un-gameable</H2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            ["Private labels", "Ground-truth answers are hand-checked and never published, so no model can be trained on them. We disclose the volume, never the data."],
            ["Anonymized results", "Only per-model aggregates ship. Contracts appear as “Doc A–F”; no identities, values, or spans leak from the leaderboard."],
            ["Fresh & obscure", "Documents are drawn from a long tail of filings and rotated as the set grows, limiting overlap with any pre-training corpus."],
          ].map(([t, d]) => (
            <div key={t} className="card rounded-xl p-5">
              <div className="text-[14px] font-semibold tracking-tight mb-1">{t}</div>
              <p className="text-[13.5px] text-muted leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 05, metrics */}
      <section className="mt-16">
        <H2 n="05">The metrics</H2>
        <p className="text-[15px] text-muted leading-relaxed max-w-[64ch] mb-6">
          A single accuracy number hides how a model fails. Each metric below has an exact definition,
          so the trade-offs stay visible.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {METRICS.map(([name, formula, desc]) => (
            <div key={name} className="panel rounded-2xl p-5">
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-[15px] font-semibold tracking-tight">{name}</div>
              </div>
              <div className="font-mono text-[11.5px] text-accent mt-1">{formula}</div>
              <p className="text-[13px] text-muted leading-relaxed mt-2.5">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 06, how we score */}
      <section className="mt-16">
        <H2 n="06">How we score, field by field</H2>
        <p className="text-[15px] text-muted leading-relaxed max-w-[64ch] mb-6">
          Every field is normalized, then compared to ground truth. Both sides get the same treatment:
          numbers pulled out of strings like <span className="mono text-text">“$0.05/min”</span>, dates
          canonicalized, a missing value treated as $0 where that’s equivalent. A field counts only if truth
          or prediction is non-empty. Fee amounts are matched on an <b className="text-text">annualized</b>{" "}
          basis, so a correct answer in a different cadence still scores.
        </p>
        {/* worked example */}
        <div className="panel rounded-2xl p-5 sm:p-6 overflow-x-auto">
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <h3 className="text-[14px] font-semibold tracking-tight">Worked example</h3>
            <span className="font-mono text-[11px] text-faint">one contract, a few fields</span>
          </div>
          <table className="w-full text-[13px] border-collapse min-w-[560px]">
            <thead>
              <tr className="font-mono text-[11px] uppercase tracking-[.06em] text-faint text-left">
                <th className="py-2 pr-4 font-medium">Field</th>
                <th className="py-2 pr-4 font-medium">Expected</th>
                <th className="py-2 pr-4 font-medium">Predicted</th>
                <th className="py-2 font-medium text-right">Result</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {[
                ["recurring_fee.amount", "25000", "25000", "✓", "text-success"],
                ["recurring_fee.frequency", "quarterly", "quarterly", "✓", "text-success"],
                ["usage_fee.amount", "180000 / yr", "45000 / qtr", "✓ annualized", "text-success"],
                ["recurring_fee.timing", "advanced", "n/a", "✗ wrong", "text-danger"],
                ["fixed_fee.amount", "0", "0", "· not scored", "text-faint"],
                ["scope_notes", "“$250k capacity…”", "“annual usage…”", "· soft (reviewed)", "text-faint"],
              ].map(([f, e, p, r, c]) => (
                <tr key={f} className="border-t border-line">
                  <td className="py-2.5 pr-4 mono text-[12px]">{f}</td>
                  <td className="py-2.5 pr-4 text-muted">{e}</td>
                  <td className="py-2.5 pr-4 text-muted">{p}</td>
                  <td className={`py-2.5 text-right font-medium ${c}`}>{r}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[12.5px] text-faint mt-3">
            Every scored field on every contract is recorded this way; the leaderboard number is Σcorrect ÷
            Σscored over all of them, across {data.n_runs} runs.
          </p>
        </div>
      </section>

      {/* 07, statistical rigor */}
      <section className="mt-16">
        <H2 n="07">Statistical rigor</H2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            ["Repeated runs", `Every contract is run ${data.n_runs}× per model. We keep the full distribution, not just a mean.`],
            ["Report the spread", "We publish run-to-run σ alongside accuracy, a single run can swing several points and mislead."],
            ["Human-checked labels", "Ground truth is hand-labeled and adjudicated; as the set scales, agreement is measured across annotators."],
          ].map(([t, d]) => (
            <div key={t} className="card rounded-xl p-5">
              <div className="text-[14px] font-semibold tracking-tight mb-1">{t}</div>
              <p className="text-[13.5px] text-muted leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 08, where it sits */}
      <section className="mt-16">
        <H2 n="08">Where FinePrint sits</H2>
        <p className="text-[15px] text-muted leading-relaxed max-w-[64ch] mb-6">
          FinePrint borrows the principles the field has converged on for credible evaluation, applied to a
          vertical the general benchmarks skip.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {LANDSCAPE.map(([principle, who, what]) => (
            <div key={principle} className="panel rounded-2xl p-5">
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-[15px] font-semibold tracking-tight">{principle}</div>
                <span className="font-mono text-[11px] text-faint">{who}</span>
              </div>
              <p className="text-[13.5px] text-muted leading-relaxed mt-2">{what}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 09, openness + limitations */}
      <section className="mt-16">
        <H2 n="09">Openness &amp; limitations</H2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card rounded-xl p-6">
            <div className="font-mono text-[11px] uppercase tracking-[.08em] text-faint mb-2">What’s open</div>
            <p className="text-[14.5px] text-muted leading-relaxed">
              The harness, the model adapters, the scorer and the aggregation are open source and unit-tested;
              anyone can run FinePrint on their own labeled data. Pricing is pulled from OpenRouter. Only the
              contract corpus and its labels are private, that’s the part that keeps the benchmark honest.
            </p>
          </div>
          <div className="card rounded-xl p-6">
            <div className="font-mono text-[11px] uppercase tracking-[.08em] text-faint mb-2">Known limitations</div>
            <p className="text-[14.5px] text-muted leading-relaxed">
              The gold set is still small while the corpus scales, so results carry run-to-run variance we
              report as σ. Extraction sits on an OCR step, so document quality matters. The schema targets
              commercial billing terms and is English-first today. We publish these limits rather than paper
              over them.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-14 flex items-center justify-between gap-4">
        <Link href="/#leaderboard" className="btn btn-ghost">Back to the leaderboard</Link>
        <span className="font-mono text-[11px] text-faint">FinePrint · by Flexprice</span>
      </div>
    </div>
  );
}
