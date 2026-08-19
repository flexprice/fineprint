// A leading * marks a word that settles on the accent blue instead of the text color,
// so the copy stays readable in source.
const PROBLEM =
  "Every invoice begins as a sentence in a contract. Read the *fee, the *cycle or the " +
  "*currency wrong and the bill goes out wrong. The best model still misses *a *fifth of them.";

// Percentages along the paragraph's `cover` range. The last word finishes at
// START + SPREAD + DWELL, kept near 50% so the fill completes while the paragraph is
// around the middle of the viewport rather than as it disappears under the header.
const START = 8;
const SPREAD = 32;
const DWELL = 8;

export function ProblemStatement() {
  const words = PROBLEM.split(" ");
  return (
    <section id="why" className="shell pt-28 pb-24">
      <p className="eyebrow mb-10">Why this exists</p>

      <p className="fill-para display text-[clamp(2rem,4.8vw,3.3rem)] leading-[1.32] max-w-[26ch]">
        {words.map((w, i) => {
          const hl = w.startsWith("*");
          const from = START + (i / words.length) * SPREAD;
          return (
            <span
              key={i}
              className={hl ? "hl" : undefined}
              style={{
                ["--from" as string]: `${from.toFixed(2)}%`,
                ["--to" as string]: `${(from + DWELL).toFixed(2)}%`,
              }}
            >
              {(hl ? w.slice(1) : w) + " "}
            </span>
          );
        })}
      </p>

      {/* Disclosure, not a pitch: a billing vendor publishing a benchmark has an obvious
          interest, so state it plainly rather than letting the reader infer it. */}
      <p className="mt-12 text-[16px] leading-relaxed text-muted max-w-[56ch]">
        We build billing software. Nobody had measured this step, so we did.
      </p>
    </section>
  );
}
