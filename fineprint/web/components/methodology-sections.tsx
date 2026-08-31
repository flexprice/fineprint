"use client";

import type { ComponentType } from "react";
import {
  StepContractVisual, StepModelVisual, StepCheckVisual, StepBoardVisual,
} from "@/components/measure-visuals";
import {
  PrivateLabelsVisual, DocumentCycle, AnonymizedDocs,
  BentoMessyTable, BentoInstallment, BentoEquiv, BentoCadence,
  BentoRedline, BentoCurrency, BentoOcr, BentoCrossDoc,
} from "@/components/methodology-visuals";

const TASK_STEPS = [
  { t: "Contract in", d: "A real PDF, read line by line.", Visual: StepContractVisual },
  { t: "Model reads it", d: "Every billing term, structured.", Visual: StepModelVisual },
  { t: "Private key check", d: "Compared against our answer key.", Visual: StepCheckVisual },
  { t: "On the leaderboard", d: "Ranked on accuracy, cost, and speed.", Visual: StepBoardVisual },
] as const;

export function MethodologyTaskSteps() {
  return (
    <ol className="fp-meth-task-steps grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {TASK_STEPS.map((s, i) => (
        <li key={s.t} className="fp-step-card">
          <div className="fp-step-visual-pane">
            <s.Visual />
          </div>
          <div className="fp-step-body">
            <div className="text-[15px] font-medium tracking-[-.015em]">{s.t}</div>
            <p className="mt-1.5 text-[12.5px] leading-snug text-muted pr-8">{s.d}</p>
            <span className="fp-step-num">{String(i + 1).padStart(2, "0")}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

const COMPLEXITY: { t: string; d: string; Visual: ComponentType }[] = [
  { t: "Messy tables", d: "Fees split across columns, not clean prose.", Visual: BentoMessyTable },
  { t: "Installment math", d: "$240k over four quarters. Models must split it.", Visual: BentoInstallment },
  { t: "Same price, two shapes", d: "$10k/qtr and $40k/yr must both score.", Visual: BentoEquiv },
  { t: "Mixed-up cadence", d: "Term, coverage, and billing get conflated.", Visual: BentoCadence },
  { t: "Redlines", d: "Only the edited figure counts.", Visual: BentoRedline },
  { t: "Multi-currency", d: "USD, EUR, GBP, INR from context.", Visual: BentoCurrency },
  { t: "OCR noise", d: "Scanned PDFs with imperfect text.", Visual: BentoOcr },
  { t: "Cross-document", d: "MSA plus order form; order form wins.", Visual: BentoCrossDoc },
];

function BentoCell({ t, d, Visual }: (typeof COMPLEXITY)[number]) {
  return (
    <article className="fp-bento-cell">
      <div className="fp-bento-visual">
        <Visual />
      </div>
      <div className="fp-bento-body">
        <div className="text-[14px] font-medium tracking-[-.01em]">{t}</div>
        <p className="mt-1 text-[12.5px] leading-snug text-muted">{d}</p>
      </div>
    </article>
  );
}

export function MethodologyComplexityBento() {
  return (
    <div className="fp-bento-grid">
      {COMPLEXITY.map((c) => (
        <BentoCell key={c.t} {...c} />
      ))}
    </div>
  );
}

const HONEST = [
  { t: "Private labels", d: "Ground truth is hand-checked and never published — we only share counts, not the data.", Visual: PrivateLabelsVisual },
  { t: "Anonymized results", d: "The leaderboard shows aggregates only, with contracts appearing as Doc A–F.", Visual: AnonymizedDocs },
  { t: "Fresh documents", d: "Filings from a long tail, rotated as the set grows.", Visual: DocumentCycle },
] as const;

export function MethodologyHonestRows() {
  return (
    <div className="fp-meth-honest-grid">
      {HONEST.map(({ t, d, Visual }) => (
        <div key={t} className="fp-meth-honest-item">
          <div className="fp-meth-honest-visual">
            <Visual />
          </div>
          <div className="fp-meth-honest-copy">
            <div className="text-[15px] font-medium tracking-[-.01em]">{t}</div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{d}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
