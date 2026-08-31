import Link from "next/link";
import type { Metadata } from "next";
import { data } from "@/lib/data";
import {
  MethodologyTaskSteps,
  MethodologyComplexityBento,
  MethodologyHonestRows,
} from "@/components/methodology-sections";
import { MethodologyBillingSchema } from "@/components/methodology-billing-schema";
import { MethodologyFieldScoring } from "@/components/methodology-field-scoring";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How FinePrint scores models on contract extraction: the task, dataset, metrics, and field-level rubric.",
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow mb-3">{children}</p>;
}

function H2({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
      <span className="font-mono text-[13px] text-accent tnum shrink-0">{n}</span>
      <h2 className="display text-[clamp(1.35rem,3.2vw,1.85rem)] min-w-0">{children}</h2>
    </div>
  );
}

function SectionLead({ children }: { children: React.ReactNode }) {
  return <p className="fp-meth-lead">{children}</p>;
}

function SubLead({ children }: { children: React.ReactNode }) {
  return <p className="fp-meth-sublead">{children}</p>;
}

const METRICS: [string, string, string][] = [
  ["Accuracy", "correct ÷ scored", "Fields the model got right, across every contract and run."],
  ["Hallucination", "wrong ÷ high-conf", "Of HIGH-confidence answers, how many were wrong."],
  ["Consistency", "σ across runs", "Run-to-run spread. Low σ means repeatable."],
  ["Cost / 1k", "tokens × price", "Projected cost to read 1,000 contracts."],
  ["Latency", "p50 / p90", "Median and tail wall-clock time per extraction."],
  ["Value", "accuracy ÷ cost", "Accuracy points per dollar spent."],
];

export default function Methodology() {
  return (
    <div className="shell py-14">
      <Eyebrow>Methodology</Eyebrow>
      <h1 className="display text-[clamp(2rem,5vw,3rem)] max-w-[16ch]">How we score models.</h1>
      <p className="fp-meth-hero-lead">
        We score one thing: can a model read a contract and get the billing terms right?
        Here is how we test it, judge each field, and keep improving.
      </p>

      <section className="fp-meth-section fp-why-section">
        <H2 n="01">Why contracts</H2>
        <SectionLead>
          Finance teams still turn contracts into data by hand. We built FinePrint because that
          work is too costly to get wrong.
        </SectionLead>
        <div className="fp-why-split">
          <div className="fp-why-col fp-why-col--left">
            <h3 className="fp-why-label">Enterprise</h3>
            <p className="fp-why-copy">
              Companies still turn contracts into{" "}
              <span className="text-accent font-medium">structured data by hand</span>. Poor contract
              management costs roughly{" "}
              <span className="text-accent font-medium">9% of revenue</span>. High-stakes text in,
              reliable records out.
            </p>
          </div>
          <div className="fp-why-divider" aria-hidden />
          <div className="fp-why-col fp-why-col--right">
            <h3 className="fp-why-label">Finance</h3>
            <p className="fp-why-copy">
              Under <span className="text-accent font-medium">ASC 606 / IFRS 15</span>, the contract
              drives recognized revenue. A{" "}
              <span className="text-accent font-medium">misread fee or cadence</span> becomes a billing
              error or audit finding. FinePrint measures who is ready.
            </p>
          </div>
        </div>
      </section>

      <section className="fp-meth-section">
        <H2 n="02">The task</H2>
        <SectionLead>
          We hand the model a real contract. It has to find every billing term we score.
        </SectionLead>
        <MethodologyTaskSteps />
        <MethodologyBillingSchema />
      </section>

      <section className="fp-meth-section">
        <H2 n="03">The dataset</H2>
        <SectionLead>
          Nothing synthetic in our set. Every document was signed by real parties.
        </SectionLead>
        <div className="fp-meth-dataset-grid">
          <div className="fp-meth-panel">
            <div className="fp-meth-panel-title">Where they come from</div>
            <p className="fp-meth-panel-copy">
              Executed commercial agreements under confidentiality, plus material-agreement exhibits
              from <b className="text-text">SEC EDGAR</b>. No synthetic docs.
            </p>
          </div>
          <div className="fp-meth-panel">
            <div className="fp-meth-panel-title">What is in the mix</div>
            <p className="fp-meth-panel-copy">
              Order forms, MSAs, renewals, scanned pages, redlines, multiple currencies. The mix
              mirrors what a RevOps team sees, not the cleanest examples.
            </p>
          </div>
        </div>

        <div className="fp-meth-dataset-bento">
          <SubLead>What makes them hard</SubLead>
          <p className="fp-meth-lead fp-meth-lead--tight">
            Real contracts are messy. These eight patterns show up in almost every run.
          </p>
          <MethodologyComplexityBento />
        </div>
      </section>

      <section className="fp-meth-section">
        <H2 n="04">Kept honest</H2>
        <SectionLead>
          We hold the answer key back on purpose to keep the board honest.
        </SectionLead>
        <MethodologyHonestRows />
      </section>

      <section className="fp-meth-section">
        <H2 n="05">Metrics</H2>
        <SectionLead>
          One accuracy score is never enough. We publish six metrics so the trade-offs stay visible.
        </SectionLead>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {METRICS.map(([name, formula, desc]) => (
            <div key={name} className="fp-metric-card">
              <div className="fp-metric-name">{name}</div>
              <p className="fp-metric-desc">{desc}</p>
              <div className="fp-metric-formula">{formula}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="fp-meth-section">
        <H2 n="06">Field scoring</H2>
        <SectionLead>
          We normalize both sides before we compare. Quarterly and annual fees can both score if
          the math matches.
        </SectionLead>
        <MethodologyFieldScoring nRuns={data.n_runs} />
      </section>

      <section className="fp-meth-section">
        <H2 n="07">Runs &amp; labels</H2>
        <SectionLead>
          Every contract runs multiple times per model. Humans stay in the loop on every label.
        </SectionLead>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            ["Repeated runs", `Each contract runs ${data.n_runs}× per model. We keep the full distribution.`],
            ["Report the spread", "Run-to-run σ sits next to accuracy on the board."],
            ["Human labels", "Ground truth is hand-labeled. Disagreements go to a human adjudicator."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-xl border border-line bg-surface px-5 py-5">
              <div className="text-[15px] font-medium tracking-[-.01em]">{t}</div>
              <p className="mt-1.5 text-[13px] text-muted leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="fp-meth-section">
        <H2 n="08">Open &amp; limited</H2>
        <SectionLead>
          Most of the stack is open. The contracts and labels stay private, by design.
        </SectionLead>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-line bg-surface px-5 py-5">
            <div className="text-[15px] font-medium tracking-[-.01em]">Open</div>
            <p className="mt-1.5 text-[13px] text-muted leading-relaxed">
              Harness, adapters, scorer, and aggregation are open source. Pricing comes from
              OpenRouter. Only the corpus and labels stay private.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface px-5 py-5">
            <div className="text-[15px] font-medium tracking-[-.01em]">Limits</div>
            <p className="mt-1.5 text-[13px] text-muted leading-relaxed">
              Gold set is still small while the corpus grows, so σ matters. Extraction depends on
              OCR quality. Schema targets commercial billing terms, English-first today.
            </p>
          </div>
        </div>
      </section>

      <div className="fp-meth-footer flex items-center justify-between gap-4">
        <Link href="/#leaderboard" className="btn btn-ghost">Back to the leaderboard</Link>
        <span className="font-mono text-[11px] text-faint">FinePrint · by Flexprice</span>
      </div>
    </div>
  );
}
