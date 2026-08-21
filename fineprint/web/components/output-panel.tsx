"use client";
// Right half of the Try-it section: the structured extraction. Before a run it holds an
// empty state; after a run it shows the fields grouped by category (with a color dot and a
// HIGH/REVIEW confidence chip) or the raw JSON. `hot` is shared with the ContractViewer so
// hovering a field lights up its citation box on the contract, and vice-versa.
import { useState } from "react";
import { CAT_COLOR } from "@/lib/categories";
import type { ExtractResult, Field } from "@/lib/playground-api";

function groupByCategory(fields: Field[]): [string, { f: Field; i: number }[]][] {
  const order: string[] = [];
  const groups: Record<string, { f: Field; i: number }[]> = {};
  fields.forEach((f, i) => {
    const cat = f.category || "Other";
    if (!groups[cat]) { groups[cat] = []; order.push(cat); }
    groups[cat].push({ f, i });
  });
  return order.map((cat) => [cat, groups[cat]]);
}

export function OutputPanel({ result, revealed, hot, setHot }: {
  result: ExtractResult | null; revealed: boolean;
  hot: number | null; setHot: (i: number | null) => void;
}) {
  const [tab, setTab] = useState<"fields" | "json">("fields");
  const show = revealed && result;
  const jsonObj = result
    ? Object.fromEntries(result.fields.map((f) => [f.field, { value: f.value, confidence: f.confidence }]))
    : {};

  return (
    <div className="panel rounded-2xl overflow-hidden flex flex-col">
      <div className="px-4 py-3 flex items-center justify-between border-b border-line">
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold">
          <span className="size-2 rounded-full" style={{ background: show ? "var(--accent)" : "var(--faint)" }} />
          Extracted schema
        </span>
        <div className="flex gap-0.5 bg-surface-2 rounded-lg p-0.5">
          {(["fields", "json"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-md text-[12.5px] font-medium ${tab === t ? "bg-surface text-text shadow-sm" : "text-muted"}`}>
              {t === "fields" ? "Fields" : "JSON"}</button>
          ))}
        </div>
      </div>

      {!show ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-6 py-14 min-h-[240px] text-faint">
          <div className="size-11 rounded-xl border border-dashed border-line flex items-center justify-center text-[19px]">⚙</div>
          <p className="text-[13.5px] max-w-[34ch] leading-relaxed">
            Read the contract on the left, then <b className="text-muted">Run extraction</b> to see the
            structured billing schema — every field cited back to the page.
          </p>
        </div>
      ) : tab === "fields" ? (
        <div className="p-2 max-h-[540px] overflow-auto">
          {groupByCategory(result!.fields).map(([cat, rows]) => (
            <div key={cat}>
              <div className="px-2.5 pt-3 pb-1 font-mono text-[9.5px] tracking-[.09em] uppercase text-faint">{cat}</div>
              {rows.map(({ f, i }) => {
                const c = CAT_COLOR[f.category] ?? CAT_COLOR.Other;
                return (
                  <button key={f.field} onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}
                    className="w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-3"
                    style={{ background: hot === i ? "var(--surface-2)" : "transparent" }}>
                    <span className="size-2.5 rounded-[3px] shrink-0" style={{ background: c }} />
                    <span className="font-mono text-[11px] text-muted w-[112px] shrink-0 truncate">{f.field}</span>
                    <span className="text-[12.5px] tnum flex-1 truncate">{f.value}</span>
                    <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded ${f.confidence === "HIGH" ? "text-faint bg-surface-2" : "text-warning"}`}
                      style={f.confidence === "HIGH" ? undefined : { background: "color-mix(in srgb, var(--warning) 13%, transparent)" }}>
                      {f.confidence === "HIGH" ? "HIGH" : "REVIEW"}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <pre className="p-4 text-[11.5px] font-mono leading-relaxed overflow-auto max-h-[540px] whitespace-pre">{JSON.stringify(jsonObj, null, 2)}</pre>
      )}

      {show && (
        <div className="mt-auto flex items-center justify-between px-4 py-2.5 border-t border-line text-[11.5px] text-faint">
          <span className="font-mono">{result!.model} · read in {result!.latency}s · {result!.fields.length} fields</span>
          <a href="/#leaderboard" className="text-accent font-semibold hover:underline">Compare on the leaderboard →</a>
        </div>
      )}
    </div>
  );
}
