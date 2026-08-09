import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { models, byId, data, money, BASELINE_LABEL } from "@/lib/data";
import { ProviderIcon } from "@/components/provider-icon";

export function generateStaticParams() {
  return models.map((m) => ({ id: m.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const m = byId((await params).id);
  if (!m) return {};
  return {
    title: `${m.label} — ${m.accuracy}% on contract extraction`,
    description: `${m.label} ranks #${m.rank} of ${data.n_models} on FinePrint: ${m.accuracy}% accuracy, ${m.halluc}% hallucination, ${money(m.cost_1k)}/1k contracts, ${m.p50}s median latency.`,
  };
}

export default async function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const m = byId((await params).id);
  if (!m) notFound();
  const delta = data.baseline_acc != null ? +(m.accuracy - data.baseline_acc).toFixed(1) : null;

  const kpis: [string, string, string?][] = [
    [`${m.accuracy}%`, "Accuracy", `#${m.rank} of ${data.n_models}`],
    [`${m.halluc}%`, "Hallucination", "HIGH-confidence & wrong"],
    [`${money(m.cost_1k)}`, "Cost / 1k contracts", `${money(m.cost_contract)} each · via OpenRouter`],
    [`${m.p50}s`, "Median latency", `p90 ${m.p90}s`],
    [`±${m.consistency}`, "Run-to-run σ", `${data.n_runs} runs`],
    [`${m.value}`, "Value", "acc. pts per $/1k"],
  ];
  const tokens: [string, number][] = [["Input", m.in_tok], ["Output", m.out_tok], ["Reasoning", m.reasoning]];
  const maxTok = Math.max(...tokens.map((t) => t[1]));

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      <Link href="/#leaderboard" className="font-mono text-[12px] text-faint hover:text-muted">← leaderboard</Link>
      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <ProviderIcon brand={m.brand} size={30} />
        <h1 className="display text-[clamp(2rem,5vw,2.8rem)]">{m.label}</h1>
        {m.new && <span className="badge badge-new">New</span>}
        <span className="font-mono text-[13px] text-faint">{m.family}</span>
      </div>
      <p className="mt-3 text-muted max-w-[60ch]">
        Ranks <b className="text-text">#{m.rank}</b> of {data.n_models} on reading real contracts into structured billing data
        {delta != null && (
          <> — <span className={delta >= 0 ? "text-success" : "text-danger"}>{delta >= 0 ? "+" : ""}{delta} pts vs {BASELINE_LABEL}</span></>
        )}.
      </p>

      <div className="mt-8 grid sm:grid-cols-3 gap-3">
        {kpis.map(([v, k, sub]) => (
          <div key={k} className="card rounded-xl p-5">
            <div className="font-mono text-[27px] font-semibold tnum tracking-tight">{v}</div>
            <div className="font-mono text-[11px] uppercase tracking-[.1em] text-faint mt-1.5">{k}</div>
            {sub && <div className="text-[12px] text-muted mt-1">{sub}</div>}
          </div>
        ))}
      </div>

      <div className="mt-4 panel rounded-xl p-6">
        <div className="font-mono text-[11px] uppercase tracking-[.08em] text-faint mb-4">Tokens per contract</div>
        <div className="flex flex-col gap-3">
          {tokens.map(([label, n]) => (
            <div key={label} className="flex items-center gap-4">
              <span className="w-20 text-[13px] text-muted">{label}</span>
              <span className="flex-1 h-2.5 rounded bg-line-2 overflow-hidden">
                <span className="block h-full" style={{ width: `${(n / maxTok) * 100}%`, background: "var(--accent)" }} />
              </span>
              <span className="w-20 text-right tnum text-[13px]">{n.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[12px] text-faint">Reliability {m.reliability}% · valid structured output across {m.calls} calls.</p>
      </div>

      <p className="mt-8 text-[13px] text-muted">
        Want the full picture? <Link href="/methodology" className="ulink">How we score →</Link>
      </p>
    </div>
  );
}
