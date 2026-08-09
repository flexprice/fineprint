"use client";

import { useState } from "react";
import Link from "next/link";
import { scaleLog, scaleLinear } from "@visx/scale";
import { models, byId, money, type ModelRow } from "@/lib/data";
import { ProviderIcon } from "@/components/provider-icon";

const MAX = 4;

// Metric rows for the side-by-side table. `better` drives the best-in-row highlight.
type Metric = {
  label: string;
  hint: string;
  better: "high" | "low";
  raw: (m: ModelRow) => number;
  fmt: (m: ModelRow) => string;
};

const METRICS: Metric[] = [
  { label: "Accuracy", hint: "higher is better", better: "high", raw: (m) => m.accuracy, fmt: (m) => `${m.accuracy}%` },
  { label: "Hallucination", hint: "lower is better", better: "low", raw: (m) => m.halluc, fmt: (m) => `${m.halluc}%` },
  { label: "Cost / 1k", hint: "lower is better", better: "low", raw: (m) => m.cost_1k, fmt: (m) => money(m.cost_1k) },
  { label: "Value", hint: "acc. pts per $/1k", better: "high", raw: (m) => m.value, fmt: (m) => (m.value >= 10 ? m.value.toFixed(0) : String(m.value)) },
  { label: "p50 latency", hint: "lower is better", better: "low", raw: (m) => m.p50, fmt: (m) => `${m.p50}s` },
  { label: "Run-to-run σ", hint: "lower is better", better: "low", raw: (m) => m.consistency, fmt: (m) => `±${m.consistency}` },
  { label: "Reliability", hint: "higher is better", better: "high", raw: (m) => m.reliability, fmt: (m) => `${m.reliability}%` },
];

const HL_BG = "color-mix(in srgb, var(--accent) 12%, transparent)";
const SEL_BG = "color-mix(in srgb, var(--accent) 14%, transparent)";

const bestOf = (metric: Metric, rows: ModelRow[]) => {
  const vals = rows.map(metric.raw);
  return metric.better === "high" ? Math.max(...vals) : Math.min(...vals);
};

export function CompareView({ initial }: { initial: string[] }) {
  const [ids, setIds] = useState<string[]>(initial);

  const syncUrl = (next: string[]) => {
    if (typeof window === "undefined") return;
    const qs = next.length ? `?models=${next.join(",")}` : "";
    window.history.replaceState(null, "", `${window.location.pathname}${qs}`);
  };

  const toggle = (id: string) => {
    setIds((prev) => {
      let next: string[];
      if (prev.includes(id)) next = prev.filter((x) => x !== id);
      else if (prev.length >= MAX) return prev;
      else next = [...prev, id];
      syncUrl(next);
      return next;
    });
  };

  const selected = ids.map((id) => byId(id)).filter((m): m is ModelRow => !!m);
  const canCompare = selected.length >= 2;

  return (
    <div className="mt-8">
      {/* multi-select picker */}
      <div className="flex flex-wrap items-center gap-2">
        {models.map((m) => {
          const on = ids.includes(m.id);
          const full = !on && ids.length >= MAX;
          return (
            <button
              key={m.id}
              onClick={() => toggle(m.id)}
              disabled={full}
              aria-pressed={on}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                on
                  ? "border-primary text-text"
                  : full
                  ? "border-line text-faint opacity-50 cursor-not-allowed"
                  : "border-line-2 text-muted hover:text-text hover:border-faint"
              }`}
              style={on ? { background: SEL_BG, borderColor: "var(--accent)" } : undefined}
            >
              <ProviderIcon brand={m.brand} size={14} />
              {m.label}
              {m.new && <span className="badge badge-new" style={{ padding: "0px 6px", fontSize: 10 }}>new</span>}
              <span className="font-mono text-[13px] leading-none text-faint">{on ? "×" : "+"}</span>
            </button>
          );
        })}
        <span className="ml-auto font-mono text-[11px] text-faint">{ids.length}/{MAX} selected</span>
      </div>

      {selected.length === 0 ? (
        <div className="panel mt-6 rounded-2xl px-6 py-16 text-center">
          <p className="text-[15px] text-muted">Select a model above to start comparing.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          {/* side-by-side table */}
          <div className="panel overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3.5 text-left font-mono text-[11px] uppercase tracking-[.06em] text-faint">
                    Metric
                  </th>
                  {selected.map((m) => (
                    <th key={m.id} className="px-4 py-3.5 text-right align-bottom">
                      <Link href={`/models/${m.id}`} className="group inline-flex flex-col items-end gap-1">
                        <span className="flex items-center gap-1.5">
                          <ProviderIcon brand={m.brand} size={15} />
                          <b className="font-semibold group-hover:text-accent transition-colors">{m.label}</b>
                        </span>
                        <span className="font-mono text-[10.5px] text-faint">#{m.rank} · {m.family}</span>
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS.map((metric) => {
                  const best = bestOf(metric, selected);
                  return (
                    <tr key={metric.label} className="border-t border-line">
                      <td className="px-4 py-3 text-left">
                        <span className="text-muted">{metric.label}</span>
                        <span className="block font-mono text-[10.5px] text-faint">{metric.hint}</span>
                      </td>
                      {selected.map((m) => {
                        const win = canCompare && metric.raw(m) === best;
                        return (
                          <td
                            key={m.id}
                            className={`px-4 py-3 text-right tnum whitespace-nowrap ${win ? "text-accent font-semibold" : "text-text"}`}
                            style={win ? { background: HL_BG } : undefined}
                          >
                            {metric.fmt(m)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* focused cost × accuracy scatter */}
          <div className="panel p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-semibold tracking-tight">Cost × accuracy</h2>
              <span className="font-mono text-[10.5px] text-faint">selected in focus</span>
            </div>
            <MiniScatter selectedIds={ids} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── focused scatter: all models plotted, non-selected dimmed ───────────────── */
const W = 460;
const H = 340;
const M = { top: 22, right: 18, bottom: 46, left: 44 };

function MiniScatter({ selectedIds }: { selectedIds: string[] }) {
  const costs = models.map((m) => Math.max(m.cost_1k, 0.5));
  const accs = models.map((m) => m.accuracy);
  const x = scaleLog({ domain: [Math.min(...costs) * 0.55, Math.max(...costs) * 1.7], range: [M.left, W - M.right] });
  const yLo = Math.min(...accs) - 3;
  const yHi = Math.min(100, Math.max(...accs) + 3);
  const y = scaleLinear({ domain: [yLo, yHi], range: [H - M.bottom, M.top] });

  const yt: number[] = [];
  const step = Math.max(2, Math.ceil((yHi - yLo) / 4));
  for (let t = Math.ceil(yLo / step) * step; t <= yHi; t += step) yt.push(t);
  const xt = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500].filter((v) => v >= x.domain()[0] && v <= x.domain()[1]);

  const sel = new Set(selectedIds);
  const ordered = [...models].sort((a, b) => Number(sel.has(a.id)) - Number(sel.has(b.id)));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full h-auto select-none" role="img"
      aria-label="Cost versus accuracy, selected models highlighted.">
      {yt.map((t) => (
        <g key={`y${t}`}>
          <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="var(--line)" />
          <text x={M.left - 7} y={y(t) + 3} textAnchor="end" fill="var(--faint)" fontSize="10" fontFamily="var(--font-mono)">{t}%</text>
        </g>
      ))}
      {xt.map((t) => (
        <text key={`x${t}`} x={x(t)} y={H - M.bottom + 15} textAnchor="middle" fill="var(--faint)" fontSize="10" fontFamily="var(--font-mono)">
          ${t < 1 ? t : Math.round(t)}
        </text>
      ))}

      {ordered.map((m) => {
        const on = sel.has(m.id);
        const cx = x(Math.max(m.cost_1k, 0.5));
        const cy = y(m.accuracy);
        return (
          <g key={m.id} opacity={on ? 1 : 0.28}>
            {on && <circle cx={cx} cy={cy} r={9} fill="var(--accent)" opacity={0.16} />}
            <circle cx={cx} cy={cy} r={on ? 5.5 : 4} fill={on ? "var(--accent)" : "var(--muted)"} stroke="var(--bg)" strokeWidth={2} />
            {on && (
              <text x={cx + 9} y={cy + 4} fill="var(--text)" fontSize="11" fontWeight={600} fontFamily="var(--font-mono)">
                {m.label.replace("GPT-", "")}
              </text>
            )}
          </g>
        );
      })}

      <text x={(M.left + W - M.right) / 2} y={H - 6} textAnchor="middle" fill="var(--muted)" fontSize="10.5" fontFamily="var(--font-mono)">
        cost per 1,000 contracts (log) →
      </text>
    </svg>
  );
}
