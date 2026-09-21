import type { Metadata } from "next";
import Link from "next/link";
import { ProviderIcon } from "@/components/provider-icon";
import raw from "@/lib/finance-reasoning.json";

type Row = {
  id: string; label: string; brand: string; rank: number; accuracy: number; ci: [number, number];
  n: number; unscored: number; cost_total: number; latency: number;
};
const board = raw as unknown as { updated: string; items: number; effort: string; priced_as_of: string; models: Row[] };

export const metadata: Metadata = {
  title: "Finance reasoning — an open benchmark",
  description:
    "Models on FinanceReasoning (hard): 238 numeric finance problems over real filings, graded automatically. An open dataset, run as published.",
};

export default function Finance() {
  return (
    <main className="shell py-16 sm:py-20">
      <p className="font-mono text-[11px] uppercase tracking-[.14em] text-faint">FinePrint · Open benchmark</p>
      <h1 className="mt-3 text-[clamp(2rem,5vw,3.25rem)] font-semibold tracking-[-.03em] leading-[1.05]">
        Finance reasoning
      </h1>
      <p className="mt-5 max-w-[68ch] text-[17px] leading-relaxed text-muted">
        {board.items} hard numeric finance problems over real filings and tables, from the open{" "}
        <a href="https://huggingface.co/datasets/BUPT-Reasoning-Lab/FinanceReasoning" className="text-text underline underline-offset-2">
          FinanceReasoning
        </a>{" "}
        dataset (CC BY 4.0). Every model gets every problem once, with the same prompt. An answer is right if it is
        within 0.2% of the dataset&rsquo;s reference, or equal to it at the reference&rsquo;s own precision.
      </p>

      <section className="mt-12 overflow-x-auto">
        <table className="w-full min-w-[640px] text-[14px]">
          <thead>
            <tr className="text-left font-mono text-[10.5px] uppercase tracking-wide text-faint">
              <th className="py-3 pr-3 font-normal">#</th>
              <th className="py-3 pr-3 font-normal">Model</th>
              <th className="py-3 pr-3 text-right font-normal">Accuracy</th>
              <th className="py-3 pr-3 text-right font-normal">95% CI</th>
              <th className="py-3 pr-3 text-right font-normal">Cost, all {board.items}</th>
              <th className="py-3 text-right font-normal">Median s / problem</th>
            </tr>
          </thead>
          <tbody>
            {board.models.map((m) => (
              <tr key={m.id} className="border-t border-line">
                <td className="py-3.5 pr-3 text-faint tnum">{m.rank}</td>
                <td className="py-3.5 pr-3">
                  <span className="flex items-center gap-2.5">
                    <ProviderIcon brand={m.brand} />
                    <b className="font-medium">{m.label}</b>
                    {m.unscored > 0 && <span className="text-[11.5px] text-faint">{m.unscored} unscored</span>}
                  </span>
                </td>
                <td className="py-3.5 pr-3 text-right tnum font-medium">{m.accuracy}%</td>
                <td className="py-3.5 pr-3 text-right tnum text-muted">{m.ci[0]}–{m.ci[1]}</td>
                <td className="py-3.5 pr-3 text-right tnum text-muted">${m.cost_total.toFixed(2)}</td>
                <td className="py-3.5 text-right tnum text-muted">{m.latency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-12 max-w-[68ch] space-y-4 text-[15px] leading-relaxed text-muted">
        <h2 className="text-[19px] font-semibold tracking-tight text-text">How to read this</h2>
        <p>
          Models with equal accuracy share a rank and are listed cheapest first. Intervals are 95% Wilson intervals on{" "}
          {board.items} problems: where two models&rsquo; intervals overlap, this benchmark does not separate them. A
          provider error is shown as unscored, never as a wrong answer. Reasoning effort is &ldquo;{board.effort}&rdquo; for
          every model that has the setting.
        </p>
        <p>
          <b className="text-text">The ceiling is below 100%.</b> On 12 problems, the two models we checked first gave the
          same answer as each other and the dataset disagreed. We hand-checked two of those: in one the reference is a
          plain arithmetic slip, in the other the question is ambiguous. We have not corrected any reference, because
          changing a benchmark after seeing results is how benchmarks stop meaning anything. Treat roughly 95% as the
          practical maximum.
        </p>
        <p>
          The dataset, prompts and grader are not ours to tune, and the{" "}
          <a href="https://github.com/flexprice/fineprint" className="text-text underline underline-offset-2">runner is open</a>.
          For FinePrint&rsquo;s own contract work see the{" "}
          <Link href="/#leaderboard" className="text-text underline underline-offset-2">extraction leaderboard</Link>.
        </p>
        <p className="text-[12.5px] text-faint">Updated {board.updated}. Costs are logged tokens at OpenRouter list prices as of {board.priced_as_of}.</p>
      </section>
    </main>
  );
}
