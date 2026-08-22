"use client";
// Right half of the Try-it section: the structured extraction. Before a run it holds an
// empty state; while a run is in flight it shows a shimmering skeleton with cycling status
// messages (so a 30–80s live extraction never reads as "stuck"); after a run it shows the
// fields grouped by category (color dot + HIGH/REVIEW chip) or the raw JSON. `hot` is shared
// with the ContractViewer so hovering a field lights up its citation box, and vice-versa.
import { useEffect, useState } from "react";
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

export function OutputPanel({ result, revealed, running, model, hot, setHot }: {
  result: ExtractResult | null; revealed: boolean; running: boolean; model?: string;
  hot: number | null; setHot: (i: number | null) => void;
}) {
  const [tab, setTab] = useState<"fields" | "json">("fields");
  const show = revealed && result && !running;
  const jsonObj = result
    ? Object.fromEntries(result.fields.map((f) => [f.field, { value: f.value, confidence: f.confidence }]))
    : {};

  return (
    <div className="panel rounded-2xl overflow-hidden flex flex-col">
      <div className="px-4 py-3 flex items-center justify-between border-b border-line">
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold">
          <span className="size-2 rounded-full" style={{ background: show || running ? "var(--accent)" : "var(--faint)", animation: running ? "fp-shimmer 1s linear infinite" : undefined }} />
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

      {running ? (
        <RunningState model={model} />
      ) : !show ? (
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
          <a href="/#leaderboard" className="text-accent font-semibold hover:underline">Compare on the leaderboard</a>
        </div>
      )}
    </div>
  );
}

function RunningState({ model }: { model?: string }) {
  const steps = [
    "Rendering the document…",
    "Running OCR (Chandra)…",
    model ? `Reading the terms with ${model}…` : "Reading the terms…",
    "Mapping citations back to the page…",
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % steps.length), 2400);
    return () => clearInterval(t);
  }, [steps.length]);
  return (
    <div className="flex-1 flex flex-col min-h-[240px] p-2">
      <div className="p-2 space-y-2.5">
        {[0, 1, 2, 3, 4].map((r) => (
          <div key={r} className="flex items-center gap-3 px-1">
            <span className="fp-shimmer size-2.5 rounded-[3px] shrink-0" />
            <span className="fp-shimmer h-3 rounded" style={{ width: `${28 + (r % 3) * 8}%` }} />
            <span className="fp-shimmer h-3 rounded flex-1" style={{ maxWidth: `${40 + (r % 2) * 18}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-auto flex items-center gap-2.5 px-4 py-3 border-t border-line">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: "var(--accent)", animation: "fp-scan 1.4s ease-in-out infinite" }} />
          <span className="relative inline-flex rounded-full size-2.5" style={{ background: "var(--accent)" }} />
        </span>
        <span className="text-[12.5px] text-muted font-mono">{steps[i]}</span>
      </div>
    </div>
  );
}
