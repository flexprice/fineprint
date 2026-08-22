import Link from "next/link";
import reviews from "@/lib/model-reviews.json";
import { models } from "@/lib/data";
import { ProviderIcon } from "@/components/provider-icon";

export const metadata = {
  title: "New model reviews · FinePrint",
  description:
    "Short, opinionated reviews of the newest LLMs — what each one is, where it wins, where it breaks, "
    + "with launch dates, live pricing, and how it scores on reading real contracts.",
};

type Review = {
  id: string; openrouter_id: string; label: string; brand: string;
  launched: string; price_in: number | null; price_out: number | null; price_note?: string;
  context: number; headline: string; one_liner: string; points: string[];
  sources: { title: string; url: string }[]; coverage: string; confidence?: string;
};

const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-US",
    { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const daysAgo = (iso: string) => {
  const d = Math.round((Date.parse(reviews.generated + "T00:00:00Z") - Date.parse(iso + "T00:00:00Z")) / 86400000);
  return d <= 0 ? "today" : d === 1 ? "1 day ago" : `${d} days ago`;
};

const fmtCtx = (n: number) => (n >= 1_000_000 ? `${Math.round(n / 1_048_576)}M` : `${Math.round(n / 1024)}K`);

export default function ReviewsPage() {
  const list = reviews.models as Review[];
  // Our own benchmark result, when the model has already been scored — the one number here that is ours.
  const scored = new Map(models.map((m) => [m.id, m]));

  return (
    <section className="shell py-14">
      <p className="eyebrow mb-3">New model reviews</p>
      <h1 className="display text-[clamp(1.9rem,4vw,2.7rem)]">What just shipped, and whether it can read a contract.</h1>
      <p className="mt-4 text-[16px] leading-relaxed text-muted max-w-[64ch]">
        Every model released in roughly the last two weeks: what it actually is, how it landed with people
        using it, and where it falls over. Launch dates and pricing come straight from OpenRouter. Where a
        model has been through FinePrint, its score is here too &mdash; that part is ours.
      </p>

      <div className="mt-10 flex flex-col gap-5">
        {list.map((m) => {
          const row = scored.get(m.id);
          const free = m.price_in === null;
          return (
            <article key={m.id} className="panel rounded-2xl overflow-hidden">
              {/* header: identity, verdict, date */}
              <div className="flex flex-wrap items-start gap-x-4 gap-y-3 px-6 pt-6">
                <span className="mt-0.5 grid place-items-center rounded-xl bg-surface-2 shrink-0" style={{ width: 44, height: 44 }}>
                  <ProviderIcon brand={m.brand} size={24} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="text-[20px] font-semibold tracking-[-.02em]">{m.label}</h2>
                    {m.headline && (
                      <span className="text-[14px] font-medium text-accent">{m.headline}</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] text-faint">
                    <time dateTime={m.launched}>{fmtDate(m.launched)}</time>
                    <span aria-hidden>·</span>
                    <span>{daysAgo(m.launched)}</span>
                    <span aria-hidden>·</span>
                    <span>{fmtCtx(m.context)} context</span>
                    <span aria-hidden>·</span>
                    <span className="font-mono">{m.openrouter_id}</span>
                  </div>
                </div>
                {/* our benchmark result, if we have one */}
                {row ? (
                  <Link href={`/models/${m.id}`}
                    className="shrink-0 rounded-xl border border-line px-4 py-2.5 text-right hover:border-accent transition-colors">
                    <div className="text-[19px] font-semibold tnum leading-none">{row.accuracy}%</div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-[.08em] text-faint">
                      #{row.rank} on FinePrint
                    </div>
                  </Link>
                ) : (
                  <span className="shrink-0 rounded-xl border border-dashed border-line px-4 py-2.5 text-right">
                    <div className="font-mono text-[10px] uppercase tracking-[.08em] text-faint leading-relaxed">
                      not yet<br />benchmarked
                    </div>
                  </span>
                )}
              </div>

              {m.one_liner && (
                <p className="px-6 mt-4 text-[15px] leading-relaxed text-muted max-w-[70ch]">{m.one_liner}</p>
              )}

              {/* Say plainly when the public record is weak, instead of letting a confident-sounding
                  review imply more certainty than the sources support. */}
              {m.confidence === "low" && (
                <p className="mx-6 mt-4 rounded-lg border border-line-2 bg-surface-2 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-muted">
                  <b className="text-text">Low confidence.</b> Little of this is independently verifiable —
                  the claims below come from small samples and community analysis, and the lab behind the
                  model has not confirmed anything.
                </p>
              )}

              {/* the review itself */}
              {m.points.length > 0 && (
                <ul className="px-6 mt-4 flex flex-col gap-2.5">
                  {m.points.map((p, i) => (
                    <li key={i} className="flex gap-3 text-[14.5px] leading-relaxed">
                      <span className="mt-[9px] size-1.5 rounded-full shrink-0" style={{ background: "var(--accent)" }} />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* pricing + sources */}
              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line px-6 py-3.5">
                <span className="font-mono text-[11.5px] text-muted">
                  {free ? (
                    <>
                      <b className="text-text">NA</b>
                      <span className="text-faint"> · {m.price_note ?? "price unlisted"}</span>
                    </>
                  ) : (
                    <>
                      <b className="text-text">${m.price_in}</b>
                      <span className="text-faint"> in</span>
                      {" / "}
                      <b className="text-text">${m.price_out}</b>
                      <span className="text-faint"> out per 1M tokens</span>
                    </>
                  )}
                </span>
                {m.sources?.length > 0 && (
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 ml-auto text-[11.5px]">
                    <span className="font-mono text-[10px] uppercase tracking-[.08em] text-faint">Sources</span>
                    {m.sources.slice(0, 4).map((s) => (
                      <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer"
                        className="ulink truncate max-w-[22ch]">{s.title}</a>
                    ))}
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <p className="mt-8 text-[12.5px] text-faint max-w-[70ch] leading-relaxed">
        Launch dates, pricing and context windows are read from the OpenRouter API. Reviews summarize
        publicly reported behaviour and independent coverage, with sources linked; where a model is too new
        for independent coverage we say so rather than fill the space. Scores shown are from FinePrint&rsquo;s
        own contract-extraction runs.
      </p>
    </section>
  );
}
