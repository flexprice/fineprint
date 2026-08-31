"use client";

import { useEffect, useState } from "react";
import { DocumentCycle } from "@/components/measure-visuals";

export { DocumentCycle };

/** Static redacted fields — labels visible, values held back (no lock / shimmer). */
export function PrivateLabelsVisual() {
  const fields = ["start_date", "fee_amount", "currency"];
  return (
    <div className="fp-measure-slot" aria-hidden>
      <div className="fp-measure-visual-inner fp-meth-private-labels">
        {fields.map((f) => (
          <div key={f} className="fp-meth-private-row">
            <span className="fp-meth-private-key">{f}</span>
            <span className="fp-meth-private-redact" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnonymizedDocs() {
  const labels = ["Doc A", "Doc B", "Doc C"];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % labels.length), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="fp-measure-slot" aria-hidden>
      <div className="fp-measure-visual-inner fp-meth-anon">
        {labels.map((l, j) => (
          <div key={l} className={`fp-meth-anon-row ${j === i ? "fp-meth-anon-row--hot" : ""}`}>
            <span className="fp-meth-anon-label">{l}</span>
            <span className="fp-meth-anon-bar" />
            <span className="fp-meth-anon-bar fp-meth-anon-bar--short" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BentoMessyTable() {
  const cells = [1, 1, 1, 0, 1, 1, 0, 1, 1];
  return (
    <div className="fp-bento-stage" aria-hidden>
      <div className="fp-meth-table-grid">
        {cells.map((on, i) => (
          <span key={i} className={`fp-meth-table-tile ${on ? "fp-meth-table-tile--on" : ""}`} />
        ))}
      </div>
    </div>
  );
}

export function BentoInstallment() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((v) => (v + 1) % 5), 900);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="fp-bento-stage" aria-hidden>
      <div className="fp-meth-install">
        <span className="fp-meth-install-total">$240k</span>
        <div className="fp-meth-install-parts">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="fp-meth-install-col">
              <span className={`fp-meth-install-part ${i < n ? "fp-meth-install-part--on" : ""}`} />
              <span className="fp-meth-install-label">$60k</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BentoEquiv() {
  const [flip, setFlip] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setFlip((v) => !v), 2400);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="fp-bento-stage" aria-hidden>
      <div className="fp-meth-equiv">
        <span className={`fp-meth-equiv-tag ${!flip ? "fp-meth-equiv-tag--on" : ""}`}>$10k / qtr</span>
        <span className="fp-meth-equiv-eq">=</span>
        <span className={`fp-meth-equiv-tag ${flip ? "fp-meth-equiv-tag--on" : ""}`}>$40k / yr</span>
      </div>
    </div>
  );
}

export function BentoCadence() {
  return (
    <div className="fp-bento-stage" aria-hidden>
      <div className="fp-meth-cadence">
        <div className="fp-meth-cadence-track">
          {["term", "coverage", "billing"].map((l) => (
            <span key={l} className="fp-meth-cadence-chip">{l}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BentoRedline() {
  return (
    <div className="fp-bento-stage" aria-hidden>
      <div className="fp-meth-redline">
        <span className="fp-meth-redline-old">$18,000</span>
        <span className="fp-meth-redline-new">$24,000</span>
      </div>
    </div>
  );
}

export function BentoCurrency() {
  const codes = ["USD", "EUR", "GBP", "INR"];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % codes.length), 1100);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="fp-bento-stage" aria-hidden>
      <div className="fp-meth-currency">
        {codes.map((c, j) => (
          <span key={c} className={`fp-meth-currency-chip ${j === i ? "fp-meth-currency-chip--on" : ""}`}>{c}</span>
        ))}
      </div>
    </div>
  );
}

export function BentoOcr() {
  return (
    <div className="fp-bento-stage" aria-hidden>
      <div className="fp-meth-ocr-doc">
        {[72, 58, 64, 48, 55].map((w, i) => (
          <span key={i} className="fp-meth-ocr-line" style={{ width: `${w}%`, animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

export function BentoCrossDoc() {
  return (
    <div className="fp-bento-stage" aria-hidden>
      <div className="fp-meth-cross">
        <span className="fp-meth-cross-doc fp-meth-cross-doc--msa">MSA</span>
        <span className="fp-meth-cross-doc fp-meth-cross-doc--of">Order</span>
      </div>
    </div>
  );
}
