"use client";

import { useMemo } from "react";
import { data, models, money, ModelRow } from "@/lib/data";
import { ProviderIcon } from "@/components/provider-icon";

/* ── shared frame ─────────────────────────────────────────────────────────── */
function Card({ title, sub, wide, children }: { title: string; sub: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`panel rounded-2xl p-5 sm:p-6 ${wide ? "md:col-span-2" : ""}`}>
      <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
      <p className="text-[12.5px] text-muted mt-0.5 mb-4">{sub}</p>
      {children}
    </div>
  );
}

const short = (m: ModelRow) => m.label;
const hue = (m: ModelRow) => (m.new ? "var(--accent)" : "var(--faint)");

/* ── horizontal bar ranking ───────────────────────────────────────────────── */
function Bars({ rows, val, fmt, max, invert }: {
  rows: ModelRow[]; val: (m: ModelRow) => number; fmt: (m: ModelRow) => string; max: number; invert?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((m) => {
        const w = Math.max(2, (val(m) / max) * 100);
        return (
          <div key={m.id} className="grid grid-cols-[minmax(0,148px)_1fr_auto] items-center gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <ProviderIcon brand={m.brand} size={14} />
              <span className="truncate text-[12.5px]" title={short(m)}>{short(m)}</span>
            </div>
            <span className="h-[7px] rounded-full bg-surface-2 overflow-hidden">
              <span className="block h-full rounded-full" style={{ width: `${w}%`, background: hue(m), opacity: invert ? 0.5 : 1 }} />
            </span>
            <span className="tnum text-[12.5px] text-muted w-14 text-right">{fmt(m)}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── document-difficulty heatmap ──────────────────────────────────────────── */
function Heatmap() {
  const c = data.contracts;
  if (!c) return null;
  const rows = [...models].sort((a, b) => b.accuracy - a.accuracy);
  const cell = (v: number | null) => {
    if (v == null) return "var(--surface-2)";
    const t = Math.max(0, Math.min(1, (v - 20) / 60)); // 20%→80% maps to faint→accent
    return `color-mix(in srgb, var(--accent) ${Math.round(t * 82 + 6)}%, var(--surface))`;
  };
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[520px]">
        <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: `150px repeat(${c.labels.length}, 1fr)` }}>
          <span />
          {c.labels.map((l, i) => (
            <div key={l} className="text-center">
              <div className="font-mono text-[10.5px] text-faint">{l.replace("Doc ", "")}</div>
              <div className="tnum text-[10px] text-muted">{c.difficulty[i] != null ? `${Math.round(c.difficulty[i]!)}%` : "—"}</div>
            </div>
          ))}
        </div>
        {rows.map((m) => (
          <div key={m.id} className="grid gap-1 mb-1 items-center" style={{ gridTemplateColumns: `150px repeat(${c.labels.length}, 1fr)` }}>
            <div className="flex items-center gap-1.5 min-w-0">
              <ProviderIcon brand={m.brand} size={12} />
              <span className="truncate text-[11.5px]" title={short(m)}>{short(m)}</span>
            </div>
            {(c.matrix[m.id] ?? c.labels.map(() => null)).map((v, i) => (
              <div key={i} className="h-6 rounded-[4px] grid place-items-center tnum text-[10px]"
                style={{ background: cell(v), color: v != null && v > 55 ? "#fff" : "var(--muted)" }}
                title={`${short(m)} · ${c.labels[i]}: ${v ?? "—"}%`}>
                {v != null ? Math.round(v) : ""}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── speed × accuracy scatter ─────────────────────────────────────────────── */
function Scatter() {
  const W = 640, H = 300, P = { t: 14, r: 14, b: 34, l: 36 };
  const acc = models.map((m) => m.accuracy);
  const lo = Math.max(1, Math.min(...models.map((m) => m.p50)) * 0.85);
  const hi = Math.max(...models.map((m) => m.p50)) * 1.1;    // log x — one slow model shouldn't crush the rest
  const yLo = Math.min(...acc) - 3, yHi = Math.min(100, Math.max(...acc) + 3);
  const x = (v: number) => P.l + (Math.log10(Math.max(v, lo)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)) * (W - P.l - P.r);
  const y = (v: number) => H - P.b - (v - yLo) / (yHi - yLo) * (H - P.t - P.b);
  const yt = [yLo, (yLo + yHi) / 2, yHi].map((v) => Math.round(v));
  const xt = [10, 20, 50, 100, 200, 500].filter((t) => t >= lo && t <= hi);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {yt.map((t) => (
        <g key={`y${t}`}>
          <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--line)" />
          <text x={P.l - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="var(--faint)">{t}%</text>
        </g>
      ))}
      {xt.map((t) => (
        <g key={`x${t}`}>
          <line x1={x(t)} x2={x(t)} y1={P.t} y2={H - P.b} stroke="var(--line)" opacity={0.5} />
          <text x={x(t)} y={H - P.b + 15} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--faint)">{t}s</text>
        </g>
      ))}
      <text x={(P.l + W - P.r) / 2} y={H - 3} textAnchor="middle" fontSize="10.5" fontFamily="var(--font-mono)" fill="var(--muted)">← faster · median latency (log)</text>
      {models.map((m) => (
        <g key={m.id}>
          <circle cx={x(m.p50)} cy={y(m.accuracy)} r={m.new ? 5 : 4} fill={hue(m)} stroke="var(--bg)" strokeWidth={1.5}>
            <title>{`${short(m)} — ${m.accuracy}% · ${m.p50}s`}</title>
          </circle>
        </g>
      ))}
    </svg>
  );
}

/* ── price spread (log dot plot) ──────────────────────────────────────────── */
function PriceSpread() {
  const W = 640, H = 92, P = { l: 12, r: 12 };
  const costs = models.map((m) => Math.max(m.cost_1k, 0.5));
  const lo = Math.min(...costs), hi = Math.max(...costs);
  const x = (v: number) => P.l + (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)) * (W - P.l - P.r);
  const ticks = [1, 5, 10, 50, 100, 300].filter((t) => t >= lo && t <= hi);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <line x1={P.l} x2={W - P.r} y1={38} y2={38} stroke="var(--line-2)" />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={34} y2={42} stroke="var(--line-2)" />
          <text x={x(t)} y={62} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--faint)">${t}</text>
        </g>
      ))}
      {models.map((m, i) => (
        <circle key={m.id} cx={x(Math.max(m.cost_1k, 0.5))} cy={38 - (i % 2 ? 9 : -9)} r={m.new ? 4.5 : 3.5}
          fill={hue(m)} stroke="var(--bg)" strokeWidth={1.5} opacity={0.9}>
          <title>{`${short(m)} — ${money(m.cost_1k)}/1k`}</title>
        </circle>
      ))}
      <text x={P.l} y={84} fontSize="10.5" fontFamily="var(--font-mono)" fill="var(--muted)">cost per 1,000 contracts (log) →</text>
    </svg>
  );
}

/* ── latency p50→p90 dumbbell ─────────────────────────────────────────────── */
function Dumbbell({ rows }: { rows: ModelRow[] }) {
  // Log scale — one model's huge p90 tail shouldn't crush everyone else's range.
  const lo = Math.max(1, Math.min(...rows.map((m) => m.p50)) * 0.85);
  const hi = Math.max(...rows.map((m) => m.p90)) * 1.15;
  const pos = (v: number) => (Math.log10(Math.max(v, lo)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)) * 100;
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((m) => (
        <div key={m.id} className="grid grid-cols-[minmax(0,140px)_1fr] items-center gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <ProviderIcon brand={m.brand} size={13} />
            <span className="truncate text-[12px]" title={short(m)}>{short(m)}</span>
          </div>
          <div className="relative h-4">
            <div className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full" style={{
              left: `${pos(m.p50)}%`, width: `${Math.max(0, pos(m.p90) - pos(m.p50))}%`, background: "var(--line-2)",
            }} />
            <span className="absolute top-1/2 size-2.5 -translate-y-1/2 -translate-x-1/2 rounded-full" style={{ left: `${pos(m.p50)}%`, background: hue(m) }}>
              <span className="sr-only">p50 {m.p50}s</span>
            </span>
            <span className="absolute top-1/2 size-2 -translate-y-1/2 -translate-x-1/2 rounded-full border" style={{ left: `${pos(m.p90)}%`, background: "var(--bg)", borderColor: "var(--faint)" }} />
            <span className="absolute -top-0.5 tnum text-[10.5px] text-faint" style={{ left: `${pos(m.p90)}%`, marginLeft: 8, transform: pos(m.p90) > 80 ? "translateX(-100%)" : undefined }}>{m.p90}s</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── by-lab rollup ────────────────────────────────────────────────────────── */
function ByLab() {
  const labs = useMemo(() => {
    const g: Record<string, ModelRow[]> = {};
    for (const m of models) (g[m.brand] ??= []).push(m);
    return Object.entries(g)
      .map(([brand, ms]) => ({ brand, n: ms.length, acc: ms.reduce((s, m) => s + m.accuracy, 0) / ms.length, best: Math.max(...ms.map((m) => m.accuracy)) }))
      .sort((a, b) => b.acc - a.acc);
  }, []);
  const max = Math.max(...labs.map((l) => l.best));
  return (
    <div className="flex flex-col gap-2.5">
      {labs.map((l) => (
        <div key={l.brand} className="grid grid-cols-[minmax(0,116px)_1fr_auto] items-center gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <ProviderIcon brand={l.brand} size={14} />
            <span className="truncate text-[12.5px] capitalize">{l.brand}</span>
            <span className="font-mono text-[10px] text-faint">×{l.n}</span>
          </div>
          <span className="relative h-[7px] rounded-full bg-surface-2 overflow-hidden">
            <span className="block h-full rounded-full" style={{ width: `${(l.acc / max) * 100}%`, background: "var(--accent)", opacity: 0.85 }} />
          </span>
          <span className="tnum text-[12.5px] text-muted w-24 text-right">{l.acc.toFixed(1)}% avg · {l.best.toFixed(0)} best</span>
        </div>
      ))}
    </div>
  );
}

/* ── section ──────────────────────────────────────────────────────────────── */
export function Analytics() {
  const byAcc = [...models].sort((a, b) => b.accuracy - a.accuracy);
  const topAcc = byAcc.slice(0, 15);
  const byValue = [...models].sort((a, b) => b.value - a.value).slice(0, 12);
  const lowHall = [...models].filter((m) => m.halluc > 0).sort((a, b) => a.halluc - b.halluc).slice(0, 12);
  const consistent = [...models].sort((a, b) => a.consistency - b.consistency).slice(0, 12);
  const fastest = [...models].sort((a, b) => a.p50 - b.p50).slice(0, 12);
  const dropped = [...models].filter((m) => m.reliability < 100).sort((a, b) => a.reliability - b.reliability).slice(0, 10);

  return (
    <section id="analytics" className="mx-auto max-w-6xl px-5 py-10">
      <div className="mb-5">
        <p className="eyebrow mb-2">The numbers</p>
        <h2 className="display text-[clamp(1.6rem,3.6vw,2.2rem)]">Ten ways to read the field.</h2>
        <p className="text-[14px] text-muted mt-2 max-w-[60ch]">
          {`${models.length} models · ${new Set(models.map((m) => m.brand)).size} labs · the same private contracts.`}
          {" "}Blue marks this generation&apos;s new releases.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Accuracy" sub="Fields read correctly, economic-equivalence aware. Top 15.">
          <Bars rows={topAcc} val={(m) => m.accuracy} fmt={(m) => `${m.accuracy}%`} max={Math.max(...topAcc.map((m) => m.accuracy))} />
        </Card>
        <Card title="Best value" sub="Accuracy points per $/1k. Cheap and good rises. Top 12.">
          <Bars rows={byValue} val={(m) => m.value} fmt={(m) => (m.value >= 10 ? m.value.toFixed(0) : m.value.toFixed(1))} max={Math.max(...byValue.map((m) => m.value))} />
        </Card>

        <Card title="Speed × accuracy" sub="Median latency vs accuracy. Up and to the left wins." wide>
          <Scatter />
        </Card>

        <Card title="Lowest hallucination" sub="Share of HIGH-confidence answers that were wrong. Lower is safer. Top 12.">
          <Bars rows={lowHall} val={(m) => m.halluc} fmt={(m) => `${m.halluc}%`} max={Math.max(...lowHall.map((m) => m.halluc))} invert />
        </Card>
        <Card title="Most consistent" sub="Run-to-run σ across repeated runs. Lower is more reliable. Top 12.">
          <Bars rows={consistent} val={(m) => m.consistency || 0.01} fmt={(m) => `±${m.consistency}`} max={Math.max(0.1, ...consistent.map((m) => m.consistency))} invert />
        </Card>

        <Card title="Document difficulty" sub="Accuracy per anonymized contract. Some documents break everyone." wide>
          <Heatmap />
        </Card>

        <Card title="Accuracy by lab" sub="Average and best accuracy per provider.">
          <ByLab />
        </Card>
        <Card title="Latency tail" sub="p50 (filled) to p90 (hollow). Wider = less predictable. Fastest 12.">
          <Dumbbell rows={fastest} />
        </Card>

        <Card title="Price spread" sub="Cost to read 1,000 contracts, log scale — a ~100× range across the field." wide>
          <PriceSpread />
        </Card>

        {dropped.length > 0 && (
          <Card title="Reliability" sub="Share of calls that returned valid structured output. Only models that dropped any.">
            <Bars rows={dropped} val={(m) => m.reliability} fmt={(m) => `${m.reliability}%`} max={100} />
          </Card>
        )}
      </div>
    </section>
  );
}
