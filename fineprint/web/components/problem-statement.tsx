import { LaunchVideo } from "@/components/launch-video";

// A leading * marks a word that settles on the accent blue instead of the text color.
const PROBLEM =
  "Every invoice begins as a sentence in a contract. Read the *fee, the *cycle or the " +
  "*currency wrong and the bill goes out wrong. The best model still misses *a *fifth of them.";

const START = 8;
const SPREAD = 32;
const DWELL = 8;

export function ProblemStatement() {
  const words = PROBLEM.split(" ");
  return (
    <section id="why" className="shell pt-14 sm:pt-20 pb-10 sm:pb-14">
      <h2 className="display text-[clamp(1.45rem,3.6vw,2.3rem)] max-w-[28ch]">
        What brought FinePrint to life
      </h2>

      <div className="mt-12 sm:mt-16 md:mt-[108px]">
        <LaunchVideo />
      </div>

      <p className="fill-para display text-[clamp(1.55rem,4.2vw,2.9rem)] leading-[1.32] max-w-[26ch] mt-12 sm:mt-20 md:mt-32">
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
    </section>
  );
}
