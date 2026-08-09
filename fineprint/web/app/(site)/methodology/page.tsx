import Link from "next/link";
import type { Metadata } from "next";
import { data } from "@/lib/data";

export const metadata: Metadata = {
  title: "Methodology",
  description: "How FinePrint scores models on contract extraction: private holdout, field-level rubric, repeated runs, hallucination rate.",
};

const SECTIONS: [string, React.ReactNode][] = [
  ["The task", <>Each model receives a real contract as OCR&rsquo;d text and must return a fixed billing schema — platform fees, usage rates, cadence, currency, entitlements (quantity + unit), commitments and the customer party — as strict JSON. This is the Flexprice production task, not an academic exam.</>],
  ["The test set", <>Real, license-clear contracts sourced from the web — order forms, master agreements, renewals, scanned and redlined documents across industries and currencies. The seed shown here is a labeled subset; the set scales toward ~200 documents. Difficulty comes from messy tables, installment math, and ambiguous language — not trick questions.</>],
  ["Private holdout", <>Ground-truth labels are hand-checked and kept internal. Because the answers are never published, no model can be trained on them — the benchmark resists contamination and gaming. We disclose the volume ({data.total_judgments.toLocaleString()} field judgments), never the data.</>],
  ["Field-level scoring", <>We score every field, not a single pass/fail. Matching is economic-equivalence aware — $10,000/quarter is counted equal to $40,000/year — so a model isn&rsquo;t penalized for a correct answer expressed differently. Free-text notes are excluded from the strict score.</>],
  ["Repeated runs", <>Models are nondeterministic, so every contract is run {data.n_runs} times. We report mean accuracy and the run-to-run standard deviation (σ) — a single run can swing several points on hard contracts and mislead.</>],
  ["Hallucination rate", <>The metric that matters for a human-review pipeline: the share of fields a model marked HIGH-confidence but got wrong. A model that&rsquo;s honestly uncertain is safer than one confidently wrong — this surfaces that difference.</>],
  ["Cost & latency", <>Cost is computed from measured input/output tokens times published per-token pricing, reported per 1,000 contracts. Latency is wall-clock per request (median and p90). 5.6-series pricing is estimated pending official rates and flagged as such.</>],
];

export default function Methodology() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      <p className="eyebrow mb-4">Methodology</p>
      <h1 className="display text-[clamp(2rem,5vw,2.9rem)]">How we score.</h1>
      <p className="mt-5 text-[16px] text-muted leading-relaxed max-w-[62ch]">
        FinePrint is built to be rigorous, transparent, and hard to game. The harness is open source; the
        labeled data is not. Here is exactly how a model earns its place on the board.
      </p>

      <div className="mt-10 flex flex-col">
        {SECTIONS.map(([title, body], i) => (
          <section key={title} className="grid sm:grid-cols-[180px_1fr] gap-x-8 gap-y-2 py-7 border-t border-line">
            <div className="flex items-start gap-3">
              <span className="font-mono text-[12px] text-faint tnum pt-0.5">{String(i + 1).padStart(2, "0")}</span>
              <h2 className="text-[16px] font-semibold tracking-tight">{title}</h2>
            </div>
            <p className="text-[14.5px] text-muted leading-relaxed">{body}</p>
          </section>
        ))}
      </div>

      <div className="mt-10 card rounded-xl p-6">
        <p className="text-[13.5px] text-muted">
          The scoring harness, providers, and aggregation are open source and unit-tested. Results are
          published as anonymized aggregates only — the contract corpus and labels stay private.
        </p>
      </div>

      <p className="mt-8 text-[13px] text-muted">
        <Link href="/#leaderboard" className="ulink">← Back to the leaderboard</Link>
      </p>
    </div>
  );
}
