import Link from "next/link";
import {
  DocumentCycle, PrivateVault,
  StepContractVisual, StepModelVisual, StepCheckVisual, StepBoardVisual,
} from "@/components/measure-visuals";

// Set false to revert step cards to icon + paragraph layout.
const VISUAL_STEPS = true;

const ICON = {
  contract: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M19 8v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7z" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  ),
  model: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M10 6h10M10 12h10M10 18h10" />
      <path d="m3 6 1.4 1.4L7.2 4.6M3 12l1.4 1.4L7.2 10.6M3 18l1.4 1.4L7.2 16.6" />
    </svg>
  ),
  board: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
    </svg>
  ),
};

const STEPS = [
  { t: "Contract in", d: "Real PDF, numbered OCR lines.", icon: ICON.contract, Visual: StepContractVisual },
  { t: "Model reads it", d: "Structured billing schema.", icon: ICON.model, Visual: StepModelVisual },
  { t: "Private key check", d: "Each field vs the answer key.", icon: ICON.check, Visual: StepCheckVisual },
  { t: "On the leaderboard", d: "Accuracy, cost, and speed.", icon: ICON.board, Visual: StepBoardVisual },
] as const;

function StepsClassic() {
  return (
    <ol className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {STEPS.map((s, i) => (
        <li key={s.t} className="relative rounded-2xl border border-line bg-surface px-5 py-6">
          <div className="flex items-center justify-between gap-3 mb-5">
            <span className="fp-step-icon">{s.icon}</span>
            <span className="font-mono text-[11px] uppercase tracking-[.1em] text-faint">
              {String(i + 1).padStart(2, "0")}
            </span>
          </div>
          <div className="text-[17px] font-medium tracking-[-.015em]">{s.t}</div>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{s.d}</p>
        </li>
      ))}
    </ol>
  );
}

function StepsVisual() {
  return (
    <ol className="mt-8 sm:mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {STEPS.map((s, i) => (
        <li key={s.t} className="fp-step-card">
          <div className="fp-step-visual-pane">
            <s.Visual />
          </div>
          <div className="fp-step-body">
            <div className="text-[15px] font-medium tracking-[-.015em]">{s.t}</div>
            <p className="mt-1.5 text-[12.5px] leading-snug text-muted pr-8">{s.d}</p>
            <span className="fp-step-num">
              {String(i + 1).padStart(2, "0")}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function WhatsInside() {
  return (
    <section id="inside" className="shell pt-10 sm:pt-14 pb-12 sm:pb-16">
      <p className="eyebrow mb-3">How we measure</p>
      <h2 className="display text-[clamp(1.9rem,4.2vw,2.6rem)] max-w-[20ch]">
        How a model gets a score.
      </h2>

      {VISUAL_STEPS ? <StepsVisual /> : <StepsClassic />}

      <div className="mt-16 sm:mt-20 grid sm:grid-cols-2 gap-x-16 lg:gap-x-20 gap-y-8">
        <div className="fp-measure-row">
          <DocumentCycle />
          <div className="fp-measure-copy">
            <div className="text-[15px] font-medium tracking-[-.01em]">Real documents</div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
              Signed contracts from public filings: order forms, MSAs, renewals. Scanned pages and
              redlines included. Nothing synthetic.
            </p>
          </div>
        </div>
        <div className="fp-measure-row">
          <PrivateVault />
          <div className="fp-measure-copy">
            <div className="text-[15px] font-medium tracking-[-.01em]">Answers stay private</div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
              Every field is hand-labeled. Those labels never ship; only the scores do. That keeps
              the benchmark honest.
            </p>
          </div>
        </div>
      </div>

      <p className="mt-14 text-[12.5px] text-faint">
        For scoring details, see our{" "}
        <Link href="/methodology" className="ulink">methodology</Link>.
      </p>
    </section>
  );
}
