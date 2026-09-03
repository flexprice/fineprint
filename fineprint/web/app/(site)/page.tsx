import Link from "next/link";
import Image from "next/image";
import { QuadrantChart } from "@/components/quadrant-chart";
import { Leaderboard } from "@/components/leaderboard";
import { Playground } from "@/components/playground";
import { Analytics } from "@/components/analytics";
import { WhatsInside } from "@/components/whats-inside";
import { ProblemStatement } from "@/components/problem-statement";
import { TeamNote } from "@/components/team-note";
import { FlexpriceCta } from "@/components/flexprice-cta";
import { LabMarquee } from "@/components/lab-marquee";
import { HeroCli } from "@/components/hero-cli";
import { ProviderIcon } from "@/components/provider-icon";
import { EmbedSnippet } from "@/components/embed-snippet";
import { data, models, newest, money } from "@/lib/data";

const LinkArrow = () => (
  <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round"
    className="size-3.5 shrink-0 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
    <path d="M7 17 17 7M17 7H9M17 7v8" />
  </svg>
);

export default function Home() {
  const top = newest();
  const priced = models.filter((m) => m.cost_1k != null && m.cost_1k > 0);
  const minCost = priced.length ? Math.min(...priced.map((m) => m.cost_1k!)) : null;
  const maxCost = priced.length ? Math.max(...priced.map((m) => m.cost_1k!)) : null;

  return (
    <>
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="fp-hero-art">
            <Image src="/hero/style-archive.webp" alt="A vivid vermilion temple archive of rolled contracts, a robed scholar reading a scroll of fine print cascading down the steps, in a lush orange garden under a cobalt sky"
              fill priority sizes="(max-width: 768px) 100vw, 72vw" className="object-cover fp-hero-art-img" style={{ objectPosition: "40% 48%" }} />
          </div>
          <div aria-hidden className="absolute inset-0 fp-hero-wash" />
          <div aria-hidden className="absolute inset-x-0 top-0 h-44"
            style={{ background: "linear-gradient(180deg, var(--bg) 0%, color-mix(in srgb, var(--bg) 45%, transparent) 58%, transparent 100%)" }} />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-36"
            style={{ background: "linear-gradient(0deg, var(--bg) 0%, transparent 100%)" }} />
        </div>

        <div className="shell flex flex-col min-h-0 md:min-h-[88vh] lg:min-h-[90vh] pt-16 md:pt-20 pb-10 md:pb-14">
          <div className="flex flex-1 flex-col justify-center">
            <h1 className="display text-[clamp(2.2rem,4.6vw,3.5rem)] max-w-[20ch] fp-up" style={{ animationDelay: ".07s" }}>
              Can your favorite model read the fine print?
            </h1>
            <p className="mt-5 sm:mt-7 text-[15.5px] sm:text-[19.5px] leading-[1.55] sm:leading-[1.62] max-w-[40ch] text-muted fp-up" style={{ animationDelay: ".12s" }}>
              Signed contracts bury their billing terms in pages of prose. FinePrint runs every new model
              over real ones and checks each field it returns against a human&rsquo;s answer.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 fp-up" style={{ animationDelay: ".15s" }}>
              <Link href="/compare" className="btn btn-primary btn-lg">Compare models</Link>
              <Link href="#leaderboard" className="btn px-0 py-3 border-0 bg-transparent text-muted hover:text-text transition-colors">
                See the leaderboard
              </Link>
            </div>
            <div className="fp-up" style={{ animationDelay: ".19s" }}>
              <HeroCli />
            </div>
          </div>

          <div className="shrink-0 pt-12 md:pt-20 lg:pt-24 w-full max-w-[min(100%,38rem)] md:max-w-[min(100%,42%)] fp-up" style={{ animationDelay: ".24s" }}>
            <p className="eyebrow mb-4">Top models tested</p>
            <LabMarquee />
          </div>
        </div>
      </section>

      <ProblemStatement />

      <WhatsInside />

      <section id="leaderboard" className="shell py-10 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div>
            <p className="eyebrow mb-3">The results</p>
            <h2 className="display text-[clamp(1.9rem,4.2vw,2.6rem)]">Every model, ranked.</h2>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/compare" className="btn btn-primary">Compare models</Link>
            <EmbedSnippet />
          </div>
        </div>
        <div className="panel rounded-xl overflow-hidden mb-4">
          <div className="p-4 sm:p-6 flex flex-wrap items-center gap-x-4 gap-y-3">
            <span className="badge badge-new">Latest tested</span>
            <ProviderIcon brand={top.brand} size={20} />
            <Link href={`/models/${top.id}`} className="group inline-flex items-center gap-2 text-[17px] sm:text-[20px] font-medium tracking-[-.02em] hover:text-accent transition-colors min-w-0">
              {top.label}
              <LinkArrow />
            </Link>
            <span className="text-[12px] text-faint">{top.family}</span>
            <p className="text-[13.5px] text-muted w-full sm:w-auto sm:ml-auto">
              Ranks <b className="text-text font-medium">#{top.rank}</b> of {data.n_models}.
            </p>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 border-t border-line divide-x divide-line">
            {([
              [`${top.accuracy}%`, "accuracy"],
              [`${top.halluc}%`, "hallucination"],
              [money(top.cost_1k), "cost per 1k"],
              [`${top.p50}s`, "p50 latency"],
            ] as [string, string][]).map(([v, k], i) => (
              <div key={k} className={`px-4 sm:px-6 py-5 sm:py-6 ${i < 2 ? "border-b sm:border-b-0 border-line" : ""}`}>
                <dt className="text-[24px] sm:text-[30px] leading-none font-medium tnum tracking-[-.035em]">{v}</dt>
                <dd className="mt-2.5 text-[12.5px] text-muted whitespace-nowrap">{k}</dd>
              </div>
            ))}
          </dl>
        </div>

        <Leaderboard models={models} />
      </section>

      {/* Try it after results — they've seen the board, now they can run one */}
      <section id="try" className="shell py-12 sm:py-16">
        <p className="eyebrow mb-3">Try it</p>
        <h2 className="display text-[clamp(1.9rem,4.2vw,2.6rem)]">Read a contract with any model.</h2>
        <p className="mt-3 text-[14.5px] text-muted max-w-[58ch]">
          Try one of the top models live on our samples, or upload your own contract. We run
          extraction in real time (it can take a minute depending on the model) and show you
          every field it pulls out.
        </p>
        <div className="mt-8">
          <Playground />
        </div>
      </section>

      <section id="quadrant" className="shell pt-10 pb-4">
        <p className="eyebrow mb-3">Cost</p>
        <h2 className="display text-[clamp(1.9rem,4.2vw,2.6rem)]">What accuracy actually costs.</h2>
        {minCost != null && maxCost != null && (
          <p className="mt-3 text-[14.5px] text-muted max-w-[56ch]">
            We ran {priced.length} priced models through the same contracts. Reading 1,000 of them
            costs between <b className="text-text font-medium">{money(minCost)}</b> and{" "}
            <b className="text-text font-medium">{money(maxCost)}</b>, depending on which model you
            pick and how verbose its output is.
          </p>
        )}
        <div className="panel rounded-2xl p-3 sm:p-7 mt-8">
          <div className="flex items-center justify-end gap-4 text-[12px] text-muted mb-3 px-1 sm:px-0">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: "var(--accent)" }} /> new</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: "var(--muted)" }} /> prior</span>
            <span className="hidden sm:flex items-center gap-1.5"><span className="w-4 border-t-2" style={{ borderColor: "var(--accent)" }} /> value frontier</span>
          </div>
          <QuadrantChart models={models} />
        </div>
      </section>

      <Analytics />

      <TeamNote />

      <FlexpriceCta />
    </>
  );
}
