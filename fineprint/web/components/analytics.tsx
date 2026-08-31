"use client";

import { useMemo, useState } from "react";
import { data, models, money, fmtValue, ModelRow } from "@/lib/data";
import { ProviderIcon } from "@/components/provider-icon";

/* ── icons — one per view, so the grid scans by shape as well as by title ──── */
const I = {
  target: <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.4" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22" /></svg>,
  value: <svg viewBox="0 0 24 24" aria-hidden><path d="M12 2v20" /><path d="M17 6.5c0-2-2.2-3-5-3s-5 .9-5 2.8c0 4.3 10 2.2 10 6.4 0 2-2.2 3.1-5 3.1s-5-1.1-5-3.1" /></svg>,
  speed: <svg viewBox="0 0 24 24" aria-hidden><path d="M4 18a8 8 0 1 1 16 0" /><path d="m12 14 4.5-4.5" /><circle cx="12" cy="18" r="1.4" /></svg>,
  alert: <svg viewBox="0 0 24 24" aria-hidden><path d="M12 4 3 19h18z" /><path d="M12 10v4" /><path d="M12 17h.01" /></svg>,
  waves: <svg viewBox="0 0 24 24" aria-hidden><path d="M2 9h4l3-5 3 16 3-9 3 5h4" /></svg>,
  grid: <svg viewBox="0 0 24 24" aria-hidden><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></svg>,
  lab: <svg viewBox="0 0 24 24" aria-hidden><path d="M9 3v6.5L4.5 18A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.8-3L15 9.5V3" /><path d="M8 3h8" /><path d="M7.5 15h9" /></svg>,
  clock: <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3.2 2" /></svg>,
  price: <svg viewBox="0 0 24 24" aria-hidden><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 2.8 12V4.8A2 2 0 0 1 4.8 2.8H12a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.8z" /><path d="M7.5 7.5h.01" /></svg>,
  shield: <svg viewBox="0 0 24 24" aria-hidden><path d="M12 3l7.5 3v5.5c0 4.6-3.1 8.1-7.5 9.5-4.4-1.4-7.5-4.9-7.5-9.5V6z" /><path d="m9 12 2.2 2.2L15.5 10" /></svg>,
};

/* ── shared frame ─────────────────────────────────────────────────────────── */
function Card({ title, sub, wide, icon, children }: {
  title: string; sub: string; wide?: boolean; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className={`panel rounded-2xl p-5 sm:p-6 flex flex-col ${wide ? "md:col-span-2" : ""}`}>
      <div className="flex items-start gap-3 mb-5">
        <span className="spec-icon shrink-0">{icon}</span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-medium tracking-tight">{title}</h3>
          <p className="text-[12.5px] leading-relaxed text-muted mt-1">{sub}</p>
        </div>
      </div>
      {/* flex-1 lets a chart opt into filling the leftover height of its grid row,
          which grid stretch gives the panel but not its contents. */}
      <div className="flex-1 flex flex-col">{children}</div>
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
              <div className="tnum text-[10px] text-muted">{c.difficulty[i] != null ? `${Math.round(c.difficulty[i]!)}%` : "n/a"}</div>
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
                title={`${short(m)} · ${c.labels[i]}: ${v ?? "n/a"}%`}>
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
  const [hover, setHover] = useState<string | null>(null);
  const acc = models.map((m) => m.accuracy);
  const lo = Math.max(1, Math.min(...models.map((m) => m.p50)) * 0.85);
  const hi = Math.max(...models.map((m) => m.p50)) * 1.1;    // log x — one slow model shouldn't crush the rest
  const yLo = Math.min(...acc) - 3, yHi = Math.min(100, Math.max(...acc) + 3);
  const x = (v: number) => P.l + (Math.log10(Math.max(v, lo)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)) * (W - P.l - P.r);
  const y = (v: number) => H - P.b - (v - yLo) / (yHi - yLo) * (H - P.t - P.b);
  const yt = [yLo, (yLo + yHi) / 2, yHi].map((v) => Math.round(v));
  const xt = [10, 20, 50, 100, 200, 500].filter((t) => t >= lo && t <= hi);
  const active = hover ? models.find((m) => m.id === hover) ?? null : null;
  // Draw the hovered point last so it is never occluded by a neighbour in a dense cluster.
  const ordered = [...models].sort((a, b) => Number(a.id === hover) - Number(b.id === hover));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none" role="img"
      aria-label="Median latency against accuracy for every model"
      onMouseLeave={() => setHover(null)}>
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
      <text x={(P.l + W - P.r) / 2} y={H - 3} textAnchor="middle" fontSize="10.5" fontFamily="var(--font-mono)" fill="var(--muted)">lower is faster · median latency (log)</text>

      {/* crosshair to the axes, so a hovered point can be read off the scales */}
      {active && (
        <g opacity={0.4}>
          <line x1={P.l} x2={x(active.p50)} y1={y(active.accuracy)} y2={y(active.accuracy)}
            stroke="var(--accent)" strokeDasharray="3 3" />
          <line x1={x(active.p50)} x2={x(active.p50)} y1={y(active.accuracy)} y2={H - P.b}
            stroke="var(--accent)" strokeDasharray="3 3" />
        </g>
      )}

      {ordered.map((m) => {
        const on = m.id === hover;
        const dim = hover !== null && !on;
        return (
          <g key={m.id} opacity={dim ? 0.25 : 1} style={{ transition: "opacity .12s" }}>
            {on && <circle cx={x(m.p50)} cy={y(m.accuracy)} r={9} fill="var(--accent)" opacity={0.18} />}
            <circle cx={x(m.p50)} cy={y(m.accuracy)} r={on ? 6 : m.new ? 5 : 4}
              fill={on ? "var(--accent)" : hue(m)} stroke="var(--bg)" strokeWidth={1.5} />
            {/* generous invisible hit area — 4px dots are near-impossible to hover reliably */}
            <circle cx={x(m.p50)} cy={y(m.accuracy)} r={12} fill="transparent" style={{ cursor: "pointer" }}
              onMouseEnter={() => setHover(m.id)} onFocus={() => setHover(m.id)} tabIndex={-1} />
          </g>
        );
      })}

      {active && (() => {
        const cx = x(active.p50), cy = y(active.accuracy);
        const tw = 176, th = 40;
        const tx = Math.min(Math.max(cx - tw / 2, P.l), W - P.r - tw);   // keep inside the plot
        const ty = cy - th - 12 < P.t ? cy + 14 : cy - th - 12;          // flip below when near the top
        return (
          <g pointerEvents="none">
            <rect x={tx} y={ty} width={tw} height={th} rx={7} fill="var(--surface)" stroke="var(--line-2)" />
            <text x={tx + 9} y={ty + 16} fontSize="11.5" fontWeight="600" fill="var(--text)">{short(active)}</text>
            <text x={tx + 9} y={ty + 31} fontSize="10.5" fontFamily="var(--font-mono)" fill="var(--muted)">
              {active.accuracy}% accuracy · {active.p50}s median
            </text>
          </g>
        );
      })()}
    </svg>
  );
}


/* ── price spread (log dot plot) ──────────────────────────────────────────── */
function PriceSpread() {
  const W = 640, H = 92, P = { l: 12, r: 12 };
  // Free/stealth models have no listed price — leave them off the cost axis.
  const priced = models.filter((m) => m.cost_1k != null);
  const costs = priced.map((m) => Math.max(m.cost_1k!, 0.5));
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
      {priced.map((m, i) => (
        <circle key={m.id} cx={x(Math.max(m.cost_1k!, 0.5))} cy={38 - (i % 2 ? 9 : -9)} r={m.new ? 4.5 : 3.5}
          fill={hue(m)} stroke="var(--bg)" strokeWidth={1.5} opacity={0.9}>
          <title>{`${short(m)}: ${money(m.cost_1k)}/1k`}</title>
        </circle>
      ))}
      <text x={P.l} y={84} fontSize="10.5" fontFamily="var(--font-mono)" fill="var(--muted)">cost per 1,000 contracts (log)</text>
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
    <div className="flex flex-col gap-2.5 h-full justify-between">
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
  // Value ranking is meaningful only for priced models — free/stealth (null value) are excluded.
  const byValue = models.filter((m) => m.value != null).sort((a, b) => b.value! - a.value!).slice(0, 12);
  const lowHall = [...models].filter((m) => m.halluc > 0).sort((a, b) => a.halluc - b.halluc).slice(0, 12);
  const byExtraction = [...models].sort((a, b) => b.extraction - a.extraction).slice(0, 12);
  // Sized to the lab count so this card and "Accuracy by lab" end up the same height
  // instead of leaving a gap under the shorter one.
  const labCount = new Set(models.map((m) => m.brand)).size;
  const fastest = [...models].sort((a, b) => a.p50 - b.p50).slice(0, labCount);
  const dropped = [...models].filter((m) => m.reliability < 100).sort((a, b) => a.reliability - b.reliability).slice(0, 10);

  return (
    <section id="analytics" className="shell py-10">
      <div className="mb-8">
        <p className="eyebrow mb-3">Going deeper</p>
        <h2 className="display text-[clamp(1.9rem,4.2vw,2.6rem)] max-w-[22ch]">
          Ten other ways to compare them.
        </h2>
        <p className="mt-3 text-[14.5px] text-muted max-w-[54ch]">
          Beyond the headline rank, we score speed, value, and hallucinations separately. Here is
          how the field looks on each axis.
        </p>
        <p className="text-[13px] text-faint mt-2">
          {`${models.length} models · ${new Set(models.map((m) => m.brand)).size} labs`}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card icon={I.target} title="Accuracy" sub="Fields read correctly. Equivalent answers count as correct. Top 15.">
          <Bars rows={topAcc} val={(m) => m.accuracy} fmt={(m) => `${m.accuracy}%`} max={Math.max(...topAcc.map((m) => m.accuracy))} />
        </Card>
        <Card icon={I.value} title="Best value" sub="Accuracy per dollar spent. Cheap and accurate rises. Top 12.">
          <Bars rows={byValue} val={(m) => m.value ?? 0} fmt={(m) => fmtValue(m.value)} max={Math.max(...byValue.map((m) => m.value ?? 0))} />
        </Card>

        <Card icon={I.speed} title="Speed × accuracy" sub="Median latency against accuracy. Up and to the left wins." wide>
          <Scatter />
        </Card>

        <Card icon={I.alert} title="Lowest hallucination" sub="Share of HIGH-confidence answers that were wrong. Lower is safer. Top 12.">
          <Bars rows={lowHall} val={(m) => m.halluc} fmt={(m) => `${m.halluc}%`} max={Math.max(...lowHall.map((m) => m.halluc))} invert />
        </Card>
        <Card icon={I.waves} title="Economic facts" sub="Accuracy on the money itself: dates, fee amounts, credits and overrides. Top 12.">
          <Bars rows={byExtraction} val={(m) => m.extraction} fmt={(m) => `${m.extraction}%`} max={Math.max(...byExtraction.map((m) => m.extraction))} />
        </Card>

        <Card icon={I.grid} title="Document difficulty" sub="Accuracy per anonymized contract. Some documents break everyone." wide>
          <Heatmap />
        </Card>

        <Card icon={I.lab} title="Accuracy by lab" sub="Average and best accuracy per provider.">
          <ByLab />
        </Card>
        <Card icon={I.clock} title="Latency tail" sub="p50 (filled) to p90 (hollow). Wider means less predictable.">
          <Dumbbell rows={fastest} />
        </Card>

        <Card icon={I.price} title="Price spread" sub="Cost to read 1,000 contracts on a log scale, a ~100× range across the field." wide>
          <PriceSpread />
        </Card>

        {/* Full width: as a half card this sat alone on the last row and read as a stray. */}
        {dropped.length > 0 && (
          <Card icon={I.shield} title="Reliability" sub="Share of calls that returned valid structured output. Only models that dropped any." wide>
            <Bars rows={dropped} val={(m) => m.reliability} fmt={(m) => `${m.reliability}%`} max={100} />
          </Card>
        )}
      </div>
    </section>
  );
}
