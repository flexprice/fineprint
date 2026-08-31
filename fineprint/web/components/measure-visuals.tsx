"use client";

import { useEffect, useState } from "react";

/* ── Bottom row: matched visual weight, same slot height ── */

const DOCS = [
  { w: 58, h: 74, lines: [72, 58, 64, 40] },
  { w: 54, h: 70, lines: [65, 50, 55] },
  { w: 60, h: 76, lines: [70, 60, 45, 38] },
  { w: 56, h: 72, lines: [68, 52, 48] },
];

export function DocumentCycle() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % DOCS.length), 2800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="fp-measure-slot" aria-hidden>
      <div className="fp-measure-visual-inner">
        {DOCS.map((doc, i) => {
          const on = i === active;
          const prev = i === (active + DOCS.length - 1) % DOCS.length;
          return (
            <div
              key={i}
              className="fp-doc-sheet"
              style={{
                width: doc.w,
                height: doc.h,
                opacity: on ? 1 : prev ? 0.32 : 0.1,
                transform: on
                  ? "translate(-50%, -50%) rotate(-2deg)"
                  : prev
                    ? "translate(calc(-50% - 10px), calc(-50% + 4px)) rotate(-5deg) scale(0.94)"
                    : "translate(calc(-50% + 8px), calc(-50% + 6px)) rotate(3deg) scale(0.9)",
                zIndex: on ? 3 : prev ? 2 : 1,
              }}
            >
              {doc.lines.map((pct, j) => (
                <span key={j} className="fp-doc-line fp-doc-line--live" style={{ width: `${pct}%`, animationDelay: `${j * 0.08}s` }} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PrivateVault() {
  return (
    <div className="fp-measure-slot" aria-hidden>
      <div className="fp-measure-visual-inner fp-vault">
        <svg viewBox="0 0 24 24" className="fp-vault-lock" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <rect x="4" y="10" width="16" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
        <div className="fp-vault-lines">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="fp-vault-line" style={{ animationDelay: `${i * 0.28}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Step card animations ─────────────────────────────────────────────────── */

export function StepContractVisual() {
  return (
    <div className="fp-step-stage" aria-hidden>
      <div className="fp-step-doc">
        {[72, 58, 64, 44, 52].map((w, i) => (
          <span key={i} className="fp-doc-line fp-doc-line--live" style={{ width: `${w}%`, animationDelay: `${i * 0.12}s` }} />
        ))}
        <span className="fp-step-scan" />
      </div>
    </div>
  );
}

export function StepModelVisual() {
  const fields = [
    { k: "fee", v: 72 },
    { k: "currency", v: 48 },
    { k: "cadence", v: 86 },
  ];
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((v) => (v + 1) % (fields.length + 1)), 1100);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="fp-step-stage" aria-hidden>
      <div className="fp-step-schema">
        <span className="fp-step-brace">{"{"}</span>
        {fields.map((f, i) => (
          <div key={f.k} className={`fp-step-field ${i < n ? "fp-step-field--on" : ""}`}>
            <span className="fp-step-field-key">{f.k}</span>
            <span className="fp-step-field-val" style={{ width: i < n ? `${f.v}%` : "18%" }} />
          </div>
        ))}
        <span className="fp-step-brace fp-step-brace--close">{"}"}</span>
      </div>
    </div>
  );
}

export function StepCheckVisual() {
  const [i, setI] = useState(0);
  const rows = [
    { ok: true, label: "fee" },
    { ok: true, label: "cadence" },
    { ok: false, label: "timing" },
  ];
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % rows.length), 1400);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="fp-step-stage" aria-hidden>
      <div className="fp-step-check">
        {rows.map((r, j) => (
          <div key={r.label} className={`fp-step-check-row ${j === i ? "fp-step-check-row--hot" : ""} ${r.ok ? "fp-step-check-row--ok" : "fp-step-check-row--bad"}`}>
            <span className="fp-step-check-mark">{r.ok ? "✓" : "✗"}</span>
            <span className="fp-step-check-label">{r.label}</span>
            <span className="fp-step-check-pip" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function StepBoardVisual() {
  const bars = [
    { h: 58, rank: 3 },
    { h: 92, rank: 1, best: true },
    { h: 72, rank: 2 },
    { h: 50, rank: 4 },
  ];
  return (
    <div className="fp-step-stage" aria-hidden>
      <div className="fp-step-bars">
        {bars.map((b, i) => (
          <div key={i} className={`fp-step-bar-wrap ${b.best ? "fp-step-bar-wrap--best" : ""}`} style={{ animationDelay: `${i * 0.15}s` }}>
            <span className="fp-step-bar" style={{ height: `${b.h}%` }} />
            <span className="fp-step-rank">{b.rank}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
