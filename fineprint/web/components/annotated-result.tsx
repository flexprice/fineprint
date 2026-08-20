"use client";
import { useState } from "react";
import { CAT_COLOR } from "@/lib/categories";
import type { ExtractResult } from "@/lib/playground-api";

export function AnnotatedResult({ result }: { result: ExtractResult }) {
  const [hot, setHot] = useState<number | null>(null);
  const [tab, setTab] = useState<"fields" | "json">("fields");
  const jsonObj = Object.fromEntries(result.fields.map((f) => [f.field, { value: f.value, confidence: f.confidence }]));
  return (
    <div className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-5 items-start">
      <div className="rounded-xl overflow-hidden border border-line-2 bg-white">
        {result.pages.map((pg, pi) => (
          <div key={pi} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pg.image} alt={`page ${pi + 1}`} className="w-full block" />
            {result.fields.flatMap((f, fi) =>
              f.boxes.filter((b) => b.page === pi).map((b, bi) => {
                const c = CAT_COLOR[f.category] ?? CAT_COLOR.Other;
                const on = hot === fi;
                return (
                  <div key={`${fi}-${bi}`} data-box onMouseEnter={() => setHot(fi)} onMouseLeave={() => setHot(null)}
                    className="absolute cursor-pointer rounded-[2px]"
                    style={{ left: `${b.box[0] * 100}%`, top: `${b.box[1] * 100}%`,
                      width: `${(b.box[2] - b.box[0]) * 100}%`, height: `${(b.box[3] - b.box[1]) * 100}%`,
                      border: `1.5px solid ${c}${on ? "" : "99"}`, background: on ? `${c}30` : "transparent",
                      boxShadow: on ? `0 0 0 2px ${c}66` : "none", transition: "all .12s" }} />
                );
              }))}
          </div>
        ))}
      </div>
      <div className="card rounded-xl">
        <div className="px-4 py-3 flex items-center justify-between border-b border-line">
          <span className="font-mono text-[11px] text-muted">{result.model} · read in {result.latency}s</span>
          <div className="flex gap-1 bg-surface-2 rounded-lg p-0.5">
            {(["fields", "json"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1 rounded-md text-[12.5px] font-medium ${tab === t ? "bg-surface text-text shadow-sm" : "text-muted"}`}>
                {t === "fields" ? "Fields" : "JSON"}</button>
            ))}
          </div>
        </div>
        {tab === "fields" ? (
          <div className="flex flex-col p-1.5">
            {result.fields.map((f, fi) => {
              const c = CAT_COLOR[f.category] ?? CAT_COLOR.Other;
              return (
                <button key={f.field} onMouseEnter={() => setHot(fi)} onMouseLeave={() => setHot(null)}
                  className="text-left px-3 py-2.5 rounded-lg flex items-center gap-3"
                  style={{ background: hot === fi ? "var(--surface-2)" : "transparent" }}>
                  <span className="size-2 rounded-[3px] shrink-0" style={{ background: c }} />
                  <span className="font-mono text-[11.5px] text-muted w-[130px] shrink-0 truncate">{f.field}</span>
                  <span className="text-[13px] tnum flex-1 truncate">{f.value}</span>
                  <span className={`font-mono text-[9.5px] ${f.confidence === "HIGH" ? "text-faint" : "text-warning"}`}>
                    {f.confidence === "HIGH" ? "HIGH" : "REVIEW"}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <pre className="p-4 text-[11.5px] font-mono overflow-auto max-h-[560px]">{JSON.stringify(jsonObj, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}
