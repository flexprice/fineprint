"use client";

import { useState } from "react";
import { scaleLog, scaleLinear } from "@visx/scale";
import { ModelRow, money } from "@/lib/data";

const W = 900;
const H = 520;
const M = { top: 30, right: 128, bottom: 54, left: 58 };

const V = {
  text: "var(--text)", muted: "var(--muted)", faint: "var(--faint)",
  line: "var(--line)", line2: "var(--line-2)", surface: "var(--surface)",
  bg: "var(--bg)", accent: "var(--accent)",
};

const accTicks = (lo: number, hi: number) => {
  const step = Math.max(5, Math.ceil((hi - lo) / 5 / 5) * 5);
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) out.push(t);
  return out;
};

type XMetric = "cost" | "latency";

export function QuadrantChart({ models }: { models: ModelRow[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [xMetric, setXMetric] = useState<XMetric>("cost");
  const isCost = xMetric === "cost";

  const xVal = (m: ModelRow) => (isCost ? Math.max(m.cost_1k, 0.5) : m.p50);
  const xs = models.map(xVal);
  const accs = models.map((m) => m.accuracy);

  let xLo: number, xHi: number;
  if (isCost) { xLo = Math.min(...xs) * 0.55; xHi = Math.max(...xs) * 1.6; }
  // Latency is log too: the slowest model is ~12x the median, and on a linear axis it
  // pushed most of the field into the left edge. Matches the scatter and dumbbell charts.
  else { xLo = Math.max(1, Math.min(...xs) * 0.8); xHi = Math.max(...xs) * 1.25; }
  const scale = scaleLog({ domain: [xLo, xHi], range: [M.left, W - M.right] });
  const x = (v: number) => scale(v) as number;

  const yLo = Math.min(...accs) - 4;
  const yHi = Math.min(100, Math.max(...accs) + 4);
  const y = scaleLinear({ domain: [yLo, yHi], range: [H - M.bottom, M.top] });

  const front: ModelRow[] = [];
  let best = -Infinity;
  for (const m of [...models].sort((a, b) => xVal(a) - xVal(b))) {
    if (m.accuracy > best) { front.push(m); best = m.accuracy; }
  }
  // Only the efficiency frontier gets a label — everything else is quiet context (hover to read).
  const frontRank = new Map(front.map((m, i) => [m.id, i]));

  const yt = accTicks(yLo, yHi);
  const xt = (isCost
    ? [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]
    : [10, 20, 50, 100, 200, 500, 1000]
  ).filter((v) => v >= xLo && v <= xHi);
  const xLabel = (t: number) => (isCost ? `$${t < 1 ? t : Math.round(t)}` : `${Math.round(t)}s`);

  return (
    <div className="relative">
      <div className="mb-3 flex items-center justify-end gap-2">
        <span className="font-mono text-[11px] text-faint">x-axis</span>
        <div className="inline-flex rounded-lg border border-line-2 p-0.5 font-mono text-[11px]">
          {([["cost", "Cost"], ["latency", "Latency"]] as const).map(([k, lbl]) => (
            <button key={k} onClick={() => setXMetric(k)} aria-pressed={xMetric === k}
              className={`rounded-md px-2.5 py-1 transition-colors ${xMetric === k ? "text-text" : "text-muted hover:text-text"}`}
              style={xMetric === k ? { background: "var(--surface-2)" } : undefined}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none" role="img"
        aria-label="Quality versus cost. Up and to the left is better.">
        {/* "good corner" cue — top-left (cheaper + more accurate) glows. No boxes, no crosshairs. */}
        <defs>
          <linearGradient id="fp-good" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={V.accent} stopOpacity={0.13} />
            <stop offset="52%" stopColor={V.accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <rect x={M.left} y={M.top} width={W - M.right - M.left} height={H - M.bottom - M.top} fill="url(#fp-good)" />
        <text x={M.left + 10} y={M.top + 17} fill={V.accent} fontFamily="var(--font-mono)" fontSize="11" fontWeight={600} letterSpacing="0.02em">
          ↖ better value
        </text>

        {yt.map((t) => (
          <g key={`y${t}`}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke={V.line} />
            <text x={M.left - 9} y={y(t) + 3} textAnchor="end" fill={V.faint} fontSize="11" fontFamily="var(--font-mono)">{t}%</text>
          </g>
        ))}
        {xt.map((t) => (
          <g key={`x${t}`}>
            <line x1={x(t)} x2={x(t)} y1={M.top} y2={H - M.bottom} stroke={V.line} opacity={0.5} />
            <text x={x(t)} y={H - M.bottom + 17} textAnchor="middle" fill={V.faint} fontSize="11" fontFamily="var(--font-mono)">{xLabel(t)}</text>
          </g>
        ))}

        {/* the efficiency frontier — one clean line through the best-at-each-price models */}
        <polyline points={front.map((m) => `${x(xVal(m))},${y(m.accuracy)}`).join(" ")}
          fill="none" stroke={V.accent} strokeWidth={2} opacity={0.5} strokeLinejoin="round" strokeLinecap="round" />

        {models.map((m, i) => {
          const cx = x(xVal(m));
          const cy = y(m.accuracy);
          const hot = m.new;
          const on = hover === i;
          const fr = frontRank.get(m.id);
          const isF = fr !== undefined;
          const showLabel = isF || on;
          const r = on ? 7 : isF ? 6 : hot ? 4.5 : 3.5;
          const dy = isF && fr! % 2 === 1 ? -15 : 9;   // split the two close frontier labels (Luna/DeepSeek)
          return (
            <g key={m.id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer", animation: `fp-pop .5s cubic-bezier(.2,.7,.2,1) ${(0.1 + i * 0.04).toFixed(2)}s both` }}>
              {isF && hot && <circle cx={cx} cy={cy} r={9} fill={V.accent} opacity={0.16}
                style={{ transformBox: "fill-box", transformOrigin: "center", animation: "fp-pulse 3.2s ease-in-out infinite" }} />}
              {on && <circle cx={cx} cy={cy} r={12} fill="none" stroke={hot ? V.accent : V.muted} strokeWidth={1} opacity={0.4} />}
              <circle cx={cx} cy={cy} r={r} fill={hot ? V.accent : V.muted} stroke={V.bg} strokeWidth={1.8}
                opacity={isF ? 1 : hot ? 0.8 : 0.4} />
              {showLabel && (
                <text x={cx + 10} y={cy + 4 + dy} fill={hot ? V.text : V.muted} fontSize="12" fontWeight={hot ? 600 : 500}
                  fontFamily="var(--font-mono)" paintOrder="stroke" stroke={V.bg} strokeWidth={3.5} strokeLinejoin="round">
                  {m.label}
                </text>
              )}
            </g>
          );
        })}

        <text x={(M.left + W - M.right) / 2} y={H - 4} textAnchor="middle" fill={V.muted} fontSize="11.5" fontFamily="var(--font-mono)">
          {isCost ? "cost per 1,000 contracts (log)" : "median latency, seconds (log)"}
        </text>
        <text transform="rotate(-90)" x={-(M.top + H - M.bottom) / 2} y={15} textAnchor="middle" fill={V.muted} fontSize="11.5" fontFamily="var(--font-mono)">
          accuracy
        </text>

        {hover !== null && (() => {
          const m = models[hover];
          const cx = x(xVal(m));
          const cy = y(m.accuracy);
          const tw = 198;
          const th = 76;
          const tx = Math.min(cx + 14, W - tw - 4);
          const ty = Math.max(cy - th - 10, 4);
          return (
            <g pointerEvents="none">
              <rect x={tx} y={ty} width={tw} height={th} rx={9} fill={V.surface} stroke={V.line2} />
              <text x={tx + 13} y={ty + 22} fill={V.text} fontSize="13.5" fontWeight={600}>
                {m.label}{m.new ? "  ·  NEW" : ""}
              </text>
              <text x={tx + 13} y={ty + 42} fill={V.muted} fontSize="12" fontFamily="var(--font-mono)">
                {m.accuracy}% accuracy · {m.halluc}% halluc
              </text>
              <text x={tx + 13} y={ty + 60} fill={V.muted} fontSize="12" fontFamily="var(--font-mono)">
                {money(m.cost_1k)}/1k · {m.p50}s p50
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
