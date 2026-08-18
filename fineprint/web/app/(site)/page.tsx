import Link from "next/link";
import Image from "next/image";
import { QuadrantChart } from "@/components/quadrant-chart";
import { Leaderboard } from "@/components/leaderboard";
import { AnnotatedContract } from "@/components/annotated-contract";
import { Analytics } from "@/components/analytics";
import { WhatsInside } from "@/components/whats-inside";
import { ProviderIcon } from "@/components/provider-icon";
import { EmbedSnippet } from "@/components/embed-snippet";
import { data, models, newest, money, BASELINE_LABEL } from "@/lib/data";

export default function Home() {
  const top = newest();
  const delta = data.baseline_acc != null ? +(top.accuracy - data.baseline_acc).toFixed(1) : null;
  const stats: [string, string][] = [
    [`${data.n_models}`, "models tested"],
    [`${data.n_contracts}`, "contracts"],
    [`${data.fields_per_contract}`, "fields / contract"],
    [data.total_judgments.toLocaleString(), "field judgments"],
  ];

  return (
    <>
      {/* hero — cinematic image + headline */}
      <section className="relative isolate overflow-hidden">
        <Image src="/hero/style-archive.webp" alt="A vivid vermilion temple archive of rolled contracts, a robed scholar reading a scroll of fine print cascading down the steps, in a lush orange garden under a cobalt sky"
          fill priority sizes="100vw" className="object-cover object-center -z-10" />
        <div aria-hidden className="absolute inset-0 -z-10"
          style={{ background: "linear-gradient(96deg, rgba(8,11,20,.88) 0%, rgba(8,11,20,.66) 32%, rgba(8,11,20,.24) 60%, rgba(8,11,20,0) 100%)" }} />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-28 -z-10"
          style={{ background: "linear-gradient(180deg, transparent, var(--bg))" }} />
        <div className="mx-auto max-w-6xl px-5 flex flex-col justify-center min-h-[80vh] py-24 text-white">
          <p className="eyebrow mb-5 fp-up" style={{ color: "rgba(255,255,255,.74)", animationDelay: ".02s" }}>
            The document-extraction benchmark · by Flexprice
          </p>
          <h1 className="display text-[clamp(2.8rem,6.6vw,4.8rem)] max-w-[16ch] fp-up"
            style={{ color: "#fff", textShadow: "0 2px 30px rgba(0,0,0,.4)", animationDelay: ".07s" }}>
            Can it read the fine print?
          </h1>
          <p className="mt-6 text-[18px] leading-relaxed max-w-[48ch] fp-up" style={{ color: "rgba(255,255,255,.82)", animationDelay: ".12s" }}>
            Every new model, put through real contracts — the messy PDFs businesses actually run on —
            and scored on whether it turns them into correct, structured data. A private test set nobody can game.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3 fp-up" style={{ animationDelay: ".17s" }}>
            <Link href="#leaderboard" className="btn" style={{ background: "#fff", color: "#0a0a0a" }}>See the leaderboard</Link>
            <Link href="#task" className="btn" style={{ color: "#fff", borderColor: "rgba(255,255,255,.3)" }}>Watch it read a contract</Link>
          </div>
          <dl className="mt-14 flex flex-wrap gap-x-10 gap-y-5 fp-up" style={{ animationDelay: ".22s" }}>
            {stats.map(([v, k]) => (
              <div key={k}>
                <dt className="text-[28px] font-semibold tnum tracking-[-.03em] text-white">{v}</dt>
                <dd className="mt-1 text-[13px]" style={{ color: "rgba(255,255,255,.6)" }}>{k}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* centerpiece: quality × cost quadrant */}
      <section id="quadrant" className="mx-auto max-w-6xl px-5 pt-12 pb-4">
        <div className="panel rounded-2xl p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
            <div>
              <h2 className="text-[19px] font-semibold tracking-tight">Quality × cost</h2>
              <p className="text-[13px] text-muted mt-1">Accuracy vs. price on real contracts. Up and to the left wins.</p>
            </div>
            <div className="flex items-center gap-4 font-mono text-[11px] text-muted">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: "var(--accent)" }} /> new</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: "var(--muted)" }} /> prior</span>
              <span className="hidden sm:flex items-center gap-1.5"><span className="w-4 border-t-2" style={{ borderColor: "var(--accent)" }} /> value frontier</span>
            </div>
          </div>
          <QuadrantChart models={models} />
        </div>
      </section>

      {/* newest-model spotlight */}
      <section className="mx-auto max-w-6xl px-5 py-4">
        <div className="card rounded-xl px-6 py-5 flex flex-wrap items-center gap-x-8 gap-y-4">
          <div className="flex items-center gap-2.5">
            <span className="badge badge-new">New</span>
            <ProviderIcon brand={top.brand} size={18} />
            <Link href={`/models/${top.id}`} className="text-[17px] font-semibold hover:text-accent transition-colors">{top.label}</Link>
            <span className="font-mono text-[11px] text-faint">{top.family}</span>
          </div>
          <p className="text-[14px] text-muted">
            Ranks <b className="text-text">#{top.rank}</b> of {data.n_models} on contract extraction
            {delta != null && (
              <> — <span className={delta >= 0 ? "text-success" : "text-danger"}>{delta >= 0 ? "+" : ""}{delta} pts vs {BASELINE_LABEL}</span></>
            )}.
          </p>
          <div className="ml-auto flex flex-wrap gap-2">
            <span className="badge">{top.accuracy}% accuracy</span>
            <span className="badge">{top.halluc}% hallucination</span>
            <span className="badge">{money(top.cost_1k)}/1k</span>
            <span className="badge">{top.p50}s p50</span>
          </div>
        </div>
      </section>

      {/* the task — annotated contract */}
      <section id="task" className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex items-end justify-between gap-3 mb-5">
          <div>
            <p className="eyebrow mb-2">The task</p>
            <h2 className="display text-[clamp(1.6rem,3.6vw,2.2rem)]">Watch a model read a real contract.</h2>
          </div>
          <p className="text-[13px] text-muted max-w-[32ch] hidden md:block">
            An actual public contract, scored live. Hover any field to see exactly where the model read it —
            boxes are its own citations.
          </p>
        </div>
        <AnnotatedContract />
      </section>

      {/* leaderboard */}
      <section id="leaderboard" className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <p className="eyebrow mb-2">Leaderboard</p>
            <h2 className="display text-[clamp(1.6rem,3.6vw,2.2rem)]">Every model, ranked.</h2>
            <p className="mt-1 text-[12px] text-muted max-w-2xl">
              <span className="badge" style={{ padding: "1px 7px", fontSize: 11 }}>v2 preview</span>{" "}
              Rebuilt scoring — <b>Extract</b> (economic facts) and <b>Conv.</b> (house conventions) scored separately.
              {" "}Labels are QA&apos;d against the contract text; corrections pending final human sign-off. n={data.n_contracts} contracts.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/compare" className="btn btn-ghost">Compare models →</Link>
            <EmbedSnippet />
          </div>
        </div>
        <Leaderboard models={models} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[11px] text-faint">
            Value = accuracy points per $/1k. Pricing from OpenRouter, updated continuously.
          </p>
          <span className="font-mono text-[11px] text-faint hidden sm:block">click a column to sort</span>
        </div>
      </section>

      <Analytics />

      <WhatsInside />

      {/* methodology CTA */}
      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="grainient rounded-2xl px-7 py-9 flex flex-wrap items-center justify-between gap-5 shadow-[var(--shadow-card)]">
          <div>
            <h2 className="text-[20px] font-semibold tracking-tight" style={{ color: "#fff" }}>Rigorous, transparent, un-gameable.</h2>
            <p className="text-[14px] mt-1.5 max-w-[54ch]" style={{ color: "rgba(255,255,255,.88)" }}>
              Read exactly how we score — the private holdout, the field-level rubric, and why we repeat every run.
            </p>
          </div>
          <Link href="/methodology" className="btn" style={{ background: "#fff", color: "#0a0a0a" }}>How we score</Link>
        </div>
      </section>
    </>
  );
}
