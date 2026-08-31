import Link from "next/link";
import Image from "next/image";
import { QuadrantChart } from "@/components/quadrant-chart";
import { Leaderboard } from "@/components/leaderboard";
import { Playground } from "@/components/playground";
import { Analytics } from "@/components/analytics";
import { WhatsInside } from "@/components/whats-inside";
import { ProblemStatement } from "@/components/problem-statement";
import { TeamNote } from "@/components/team-note";
import { ProviderIcon } from "@/components/provider-icon";
import { EmbedSnippet } from "@/components/embed-snippet";
import { data, models, newest, money, BASELINE_LABEL } from "@/lib/data";

export default function Home() {
  const top = newest();
  const delta = data.baseline_acc != null ? +(top.accuracy - data.baseline_acc).toFixed(1) : null;

  return (
    <>
      {/* Hero. The artwork sits on the right and is washed into the page background on
          every edge, so the copy runs on plain paper instead of over a scrim. */}
      <section className="relative isolate overflow-hidden [--band:270px] sm:[--band:340px] lg:[--band:0px]">
        {/* Full-bleed so the wash is measured against the viewport, not a nested box.
            The copy column ends around 44%, so the background stays solid to there and
            only then starts to reveal the artwork. */}
        <div className="absolute inset-0 -z-10">
          {/* Two levers push the artwork right: the box is inset from the left, and at
              this box aspect object-cover is height-driven, which leaves horizontal
              slack for objectPosition's X to pan within. (At full-bleed width there is
              zero slack and X does nothing, which is why the inset is needed too.)
              Below lg there is no room to run copy beside the artwork, so it moves to
              the bottom band of the section and the copy sits above it on plain paper. */}
          {/* --band is the mobile artwork height; the copy column reserves the same
              amount of bottom padding, so the two never overlap at any viewport
              height. A percentage would not do: % padding resolves against WIDTH
              while a % height resolves against HEIGHT, and the two drift apart. */}
          <div className="absolute inset-x-0 bottom-0 h-[var(--band)] lg:inset-y-0 lg:left-auto lg:right-0 lg:h-auto lg:w-[72%]">
            <Image src="/hero/style-archive.webp" alt="A vivid vermilion temple archive of rolled contracts, a robed scholar reading a scroll of fine print cascading down the steps, in a lush orange garden under a cobalt sky"
              fill priority sizes="(max-width: 1024px) 100vw, 90vw" className="object-cover" style={{ objectPosition: "0% 46%" }} />
            {/* Softens the band's top edge into the page. Desktop uses the
                horizontal wash below instead, so this is scoped out there. */}
            <div aria-hidden className="absolute inset-0 lg:hidden"
              style={{ background: "linear-gradient(180deg, var(--bg) 0%, color-mix(in srgb, var(--bg) 55%, transparent) 26%, transparent 58%)" }} />
          </div>
          {/* Washes stay on the full section so their stops are viewport-relative.
              The horizontal one only makes sense once the copy has a column of its
              own; on narrow screens it would sit over the copy instead of beside it. */}
          <div aria-hidden className="absolute inset-0 hidden lg:block"
            style={{ background: "linear-gradient(90deg, var(--bg) 0%, var(--bg) 44%, color-mix(in srgb, var(--bg) 80%, transparent) 50%, color-mix(in srgb, var(--bg) 52%, transparent) 56%, color-mix(in srgb, var(--bg) 26%, transparent) 61%, color-mix(in srgb, var(--bg) 8%, transparent) 66%, transparent 71%)" }} />
          <div aria-hidden className="absolute inset-x-0 top-0 h-44 hidden lg:block"
            style={{ background: "linear-gradient(180deg, var(--bg) 0%, color-mix(in srgb, var(--bg) 45%, transparent) 58%, transparent 100%)" }} />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-36"
            style={{ background: "linear-gradient(0deg, var(--bg) 0%, transparent 100%)" }} />
        </div>

        <div className="shell flex flex-col justify-center min-h-[70vh] lg:min-h-[82vh] pt-16 pb-[calc(var(--band)+28px)] lg:py-20">
          {/* self-start: the shell is a flex column, so a bare inline-flex chip would
              otherwise stretch the full width. */}
          <h1 className="display text-[clamp(2.2rem,4.6vw,3.5rem)] max-w-[20ch] fp-up" style={{ animationDelay: ".07s" }}>
            Can your favorite model read the fine print?
          </h1>
          <p className="mt-7 text-[19.5px] leading-[1.62] max-w-[40ch] text-muted fp-up" style={{ animationDelay: ".12s" }}>
            Signed contracts bury their billing terms in pages of prose. FinePrint runs every new model
            over real ones and checks each field it returns against a human&rsquo;s answer.
          </p>
          {/* One primary action; the others are supporting links, not peers. */}
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 fp-up" style={{ animationDelay: ".17s" }}>
            <Link href="/compare" className="btn btn-primary btn-lg">Compare models</Link>
            <Link href="#leaderboard" className="btn px-0 py-3 border-0 bg-transparent text-muted hover:text-text transition-colors">
              See the leaderboard
            </Link>
          </div>
        </div>
      </section>

      {/* the problem, stated once and plainly */}
      <ProblemStatement />

      {/* method: how the score is produced */}
      <WhatsInside />

      {/* try it: the method made interactive — pick a contract + model, read it, run it */}
      <section id="try" className="shell py-16">
        <p className="eyebrow mb-3">Try it · live on this page</p>
        <h2 className="display text-[clamp(1.9rem,4.2vw,2.6rem)]">Read a contract with any model.</h2>
        <p className="mt-4 text-[15px] leading-relaxed text-muted max-w-[64ch]">
          Pick a sample contract (or bring your own) and a model, then run it. The document opens on
          the left; every field the model extracts is boxed on the page and laid out as a structured
          schema on the right — each one cited back to the line it was read from.
        </p>
        <div className="mt-8">
          <Playground />
        </div>
      </section>

      {/* leaderboard */}
      <section id="leaderboard" className="shell py-14">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div>
            <p className="eyebrow mb-3">The results</p>
            <h2 className="display text-[clamp(1.9rem,4.2vw,2.6rem)]">Every model, ranked.</h2>
            {/* v2 scoring note, carried over from main. */}
            <p className="mt-3 text-[12.5px] leading-relaxed text-muted max-w-2xl">
              <span className="badge" style={{ padding: "1px 7px", fontSize: 11 }}>v2 preview</span>{" "}
              Rebuilt scoring. <b className="text-text font-medium">Extract</b> covers the economic facts and{" "}
              <b className="text-text font-medium">Conv.</b> covers house conventions, scored separately. Labels are
              QA&rsquo;d against the contract text, with corrections pending final human sign-off.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/compare" className="btn btn-primary">Compare models</Link>
            <EmbedSnippet />
          </div>
        </div>
        {/* the newest entry, called out above the board it sits in */}
        {/* Identity on top, then the figures on their own divided row so the numbers
            read as the point of the card rather than as trailing metadata. */}
        <div className="panel rounded-xl overflow-hidden mb-4">
          <div className="p-6 flex flex-wrap items-center gap-x-4 gap-y-3">
            <span className="badge badge-new">Latest tested</span>
            <ProviderIcon brand={top.brand} size={20} />
            <Link href={`/models/${top.id}`} className="text-[20px] font-medium tracking-[-.02em] hover:text-accent transition-colors">{top.label}</Link>
            <span className="text-[12px] text-faint">{top.family}</span>
            <p className="text-[13.5px] text-muted ml-auto">
              Ranks <b className="text-text font-medium">#{top.rank}</b> of {data.n_models}
              {delta != null && (
                <>, <span className={delta >= 0 ? "text-success" : "text-danger"}>{delta >= 0 ? "+" : ""}{delta} pts vs {BASELINE_LABEL}</span></>
              )}.
            </p>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 border-t border-line divide-x divide-line">
            {([
              [`${top.accuracy}%`, "accuracy"],
              [`${top.halluc}%`, "hallucination"],
              [money(top.cost_1k), "cost per 1k"],
              [`${top.p50}s`, "p50 latency"],
            ] as [string, string][]).map(([v, k], i) => (
              <div key={k} className={`px-6 py-6 ${i < 2 ? "border-b sm:border-b-0 border-line" : ""}`}>
                <dt className="text-[30px] leading-none font-medium tnum tracking-[-.035em]">{v}</dt>
                <dd className="mt-2.5 text-[12.5px] text-muted whitespace-nowrap">{k}</dd>
              </div>
            ))}
          </dl>
        </div>

        <Leaderboard models={models} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] text-faint">
            Value = accuracy points per $/1k. Pricing from OpenRouter, updated continuously.
          </p>
          <span className="text-[12px] text-faint hidden sm:block">Click a column to sort.</span>
        </div>
      </section>

      {/* centerpiece: quality × cost quadrant */}
      <section id="quadrant" className="shell pt-10 pb-4">
        <p className="eyebrow mb-3">Cost</p>
        <h2 className="display text-[clamp(1.9rem,4.2vw,2.6rem)]">What accuracy actually costs.</h2>
        <p className="mt-4 text-[15px] leading-relaxed text-muted max-w-[64ch]">
          Accuracy against the cost of reading a thousand contracts. High and to the left is the
          place to be. The line traces the best accuracy available at each price.
        </p>
        <div className="panel rounded-2xl p-5 sm:p-7 mt-8">
          <div className="flex items-center justify-end gap-4 text-[12px] text-muted mb-3">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: "var(--accent)" }} /> new</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: "var(--muted)" }} /> prior</span>
            <span className="hidden sm:flex items-center gap-1.5"><span className="w-4 border-t-2" style={{ borderColor: "var(--accent)" }} /> value frontier</span>
          </div>
          <QuadrantChart models={models} />
        </div>
      </section>

      <Analytics />

      {/* how this came about, in the team's own words */}
      <TeamNote />

      {/* methodology CTA */}
      <section className="shell py-10">
        <div className="grainient rounded-2xl px-8 sm:px-10 py-10 flex flex-wrap items-center justify-between gap-x-10 gap-y-6 shadow-[var(--shadow-card)]">
          <div className="max-w-[46ch]">
            <h2 className="text-[20px] font-medium tracking-tight" style={{ color: "var(--brand-cream)" }}>The answer key stays private.</h2>
            <p className="text-[14px] mt-1.5 max-w-[54ch]" style={{ color: "rgba(255,252,246,.86)" }}>
              How a field is judged correct, why every model runs three times, and where this
              benchmark still falls short.
            </p>
          </div>
          <Link href="/methodology" className="btn shrink-0" style={{ background: "var(--brand-cream)", color: "#092e44" }}>Read the methodology</Link>
        </div>
      </section>
    </>
  );
}
