"use client";
// Right half of the Try-it section: the structured extraction. Before a run it holds an
// empty state; while a run is in flight it shows a shimmering skeleton with cycling status
// messages (so a 30–80s live extraction never reads as "stuck"); after a run it shows the
// fields grouped by category (color dot + HIGH/REVIEW chip) or the raw JSON. `hot` is shared
// with the ContractViewer so hovering a field lights up its citation box, and vice-versa.
// The body is a fixed height and the status bar is always mounted, so none of those four
// states — nor flipping Fields/JSON — changes how tall the panel is.
import { useEffect, useMemo, useState } from "react";
import { CAT_COLOR, PANEL_H } from "@/lib/categories";
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

  // Cycled in the status bar while a run is in flight. Lives here rather than in the skeleton
  // so the running and finished states share one bar instead of stacking two.
  const steps = useMemo(() => [
    "Rendering the document…",
    "Running OCR (Chandra)…",
    model ? `Reading the terms with ${model}…` : "Reading the terms…",
    "Mapping citations back to the page…",
  ], [model]);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!running) { setStep(0); return; }
    const t = setInterval(() => setStep((n) => (n + 1) % steps.length), 2400);
    return () => clearInterval(t);
  }, [running, steps.length]);

  return (
    <div className={`panel rounded-2xl overflow-hidden flex flex-col ${PANEL_H}`}>
      <div className="shrink-0 px-4 py-3 flex items-center justify-between border-b border-line">
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold">
          <span className="size-2 rounded-full" style={{ background: show || running ? "var(--accent)" : "var(--faint)", animation: running ? "fp-ping 1.6s cubic-bezier(0,0,.2,1) infinite" : undefined }} />
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

      {/* Takes whatever the fixed-height shell has left over, and scrolls inside it — so the
          skeleton, the empty state, the field list and the raw JSON are all the same size. */}
      <div className="flex-1 min-h-0" key={running ? "run" : !show ? "idle" : tab}>
        {running ? (
          // Enough rows to fill the shell (extras clip) and a category bar every fourth, so the
          // skeleton has the same shape as the grouped field list it is standing in for.
          <div className="fp-fade h-full overflow-hidden p-3 space-y-2.5">
            {Array.from({ length: 18 }, (_, r) => (
              r % 5 === 0
                ? <span key={r} className="fp-shimmer block h-2 w-[64px] rounded mt-3.5 mb-1.5" />
                : <div key={r} className="flex items-center gap-3 px-1">
                    <span className="fp-shimmer size-2.5 rounded-[3px] shrink-0" />
                    <span className="fp-shimmer h-3 rounded" style={{ width: `${28 + (r % 3) * 8}%` }} />
                    <span className="fp-shimmer h-3 rounded flex-1" style={{ maxWidth: `${40 + (r % 2) * 18}%` }} />
                  </div>
            ))}
          </div>
        ) : !show ? (
          <div className="fp-fade h-full flex flex-col items-center justify-center text-center gap-3 px-6 text-faint">
            <div className="size-11 rounded-xl border border-dashed border-line flex items-center justify-center text-[19px]">⚙</div>
            <p className="text-[13.5px] max-w-[34ch] leading-relaxed">
              Read the contract on the left, then <b className="text-muted">Run extraction</b> to see the
              structured billing schema — every field cited back to the page.
            </p>
          </div>
        ) : tab === "fields" ? (
          <div className="fp-fade h-full overflow-auto p-2">
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
          <pre className="fp-fade h-full overflow-auto p-4 text-[11.5px] font-mono leading-relaxed whitespace-pre">{JSON.stringify(jsonObj, null, 2)}</pre>
        )}
      </div>

      {/* Always mounted: the panel must not grow by a bar's height the moment a run lands. */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 border-t border-line text-[11.5px] text-faint">
        {running ? (
          <span className="inline-flex items-center gap-2.5 min-w-0">
            <span className="relative flex size-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: "var(--accent)", animation: "fp-ping 1.6s cubic-bezier(0,0,.2,1) infinite" }} />
              <span className="relative inline-flex rounded-full size-2.5" style={{ background: "var(--accent)" }} />
            </span>
            <span className="font-mono text-muted truncate">{steps[step]}</span>
          </span>
        ) : show ? (
          <span className="font-mono truncate">{result!.model} · read in {result!.latency}s · {result!.fields.length} fields</span>
        ) : (
          <span className="font-mono truncate">no extraction yet</span>
        )}
        <a href="/#leaderboard" className={`text-accent font-semibold hover:underline shrink-0 ${running ? "invisible" : ""}`}>Compare on the leaderboard</a>
      </div>
    </div>
  );
}
