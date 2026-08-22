"use client";

import { useState } from "react";
import Link from "next/link";
import { ModelRow, money, fmtValue } from "@/lib/data";
import { ProviderIcon } from "@/components/provider-icon";

type Col = { key: keyof ModelRow; label: string; render: (m: ModelRow) => React.ReactNode; num: boolean };

const COLS: Col[] = [
  { key: "rank", label: "#", num: true, render: (m) => <span className="text-faint tnum">{m.rank}</span> },
  {
    key: "label", label: "Model", num: false,
    render: (m) => (
      <Link href={`/models/${m.id}`} className="flex items-center gap-2.5 group">
        <ProviderIcon brand={m.brand} />
        <b className="font-medium group-hover:text-accent transition-colors">{m.label}</b>
        {m.new && <span className="badge badge-new" style={{ padding: "1px 7px", fontSize: 11 }}>New</span>}
        <span className="text-[11.5px] text-faint">{m.family}</span>
      </Link>
    ),
  },
  {
    key: "accuracy", label: "Accuracy", num: true,
    render: (m) => (
      <div className="relative inline-flex flex-col items-end">
        <span className={`tnum ${m.rank === 1 ? "text-text font-medium" : ""}`}>{m.accuracy}%</span>
        <span className="mt-1 h-[3px] w-16 rounded-full bg-line-2 overflow-hidden">
          <span className="block h-full rounded-full" style={{ width: `${m.accuracy}%`, background: "var(--accent)" }} />
        </span>
      </div>
    ),
  },
  { key: "extraction", label: "Extract", num: true, render: (m) => <span className="tnum" title="economic facts: dates, fee amounts, credits, overrides">{m.extraction}%</span> },
  { key: "convention", label: "Conv.", num: true, render: (m) => <span className="tnum text-faint" title="house-convention fields: fee timing, period, credit type">{m.convention}%</span> },
  { key: "halluc", label: "Halluc.", num: true, render: (m) => <span className="tnum">{m.halluc}%</span> },
  { key: "cost_1k", label: "$/1k", num: true, render: (m) => <span className="tnum">{money(m.cost_1k)}</span> },
  {
    key: "value", label: "Value", num: true,
    render: (m) => <span className="tnum" title="accuracy points per $/1k">{fmtValue(m.value)}</span>,
  },
  { key: "p50", label: "p50", num: true, render: (m) => <span className="tnum">{m.p50}s</span> },
  { key: "reliability", label: "Valid", num: true, render: (m) => <span className="tnum text-faint">{m.reliability}%</span> },
];

export function Leaderboard({ models }: { models: ModelRow[] }) {
  const [sortKey, setSortKey] = useState<keyof ModelRow>("accuracy");
  const [asc, setAsc] = useState(false);

  const rows = [...models].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (av == null || bv == null) {                 // NA (null cost/value) always sinks to the bottom
      return av == bv ? 0 : av == null ? 1 : -1;
    }
    const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
    return asc ? cmp : -cmp;
  });

  const onSort = (k: keyof ModelRow) => {
    if (k === sortKey) setAsc(!asc);
    else { setSortKey(k); setAsc(false); }
  };

  return (
    <div className="panel overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {COLS.map((c) => (
              <th key={String(c.key)} onClick={() => onSort(c.key)}
                className={`px-4 py-3 text-[11px] font-medium uppercase tracking-[.07em] text-faint cursor-pointer hover:text-muted select-none whitespace-nowrap ${c.num ? "text-right" : "text-left"}`}>
                {c.label}
                {sortKey === c.key && (
                  // Drawn, not typed: arrow glyphs fall back inconsistently across fonts.
                  <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round"
                    className={`inline-block size-3 ml-1 align-middle ${asc ? "rotate-180" : ""}`}>
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className="border-t border-line hover:bg-surface-2/70 transition-colors">
              {COLS.map((c) => (
                <td key={String(c.key)} className={`px-4 py-3 whitespace-nowrap ${c.num ? "text-right" : "text-left"}`}>
                  {c.render(m)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
