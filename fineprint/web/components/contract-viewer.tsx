"use client";
// Left half of the Try-it section: the contract itself, in a scrollable window. The page
// image(s) show as soon as a sample is picked (before any run) so the document can be read.
// Once a run reveals results, every field's citation box is drawn over the page; hovering a
// box lights up its row in the OutputPanel (shared `hot`), and vice-versa. When the user is
// in upload mode with nothing chosen yet, the body is a drop zone instead.
import type { Page, Field } from "@/lib/playground-api";
import { CAT_COLOR } from "@/lib/categories";

export function ContractViewer({
  pages, fields, revealed, hot, setHot, mode, file, onFile, loading, source,
}: {
  pages: Page[]; fields: Field[]; revealed: boolean;
  hot: number | null; setHot: (i: number | null) => void;
  mode: "sample" | "upload"; file: File | null; onFile: (f: File | null) => void;
  loading: boolean; source: string;
}) {
  const hasPages = pages.length > 0;
  const headerLeft = mode === "upload" && !hasPages ? "Your document" : source;
  const headerRight = revealed ? `${fields.length} fields cited` : hasPages ? "scroll to read ↓" : "";

  return (
    <div className="panel rounded-2xl overflow-hidden">
      <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-line bg-surface-2">
        <span className="font-mono text-[10px] tracking-[.08em] uppercase text-faint truncate">{headerLeft}</span>
        <span className="font-mono text-[10px] tracking-[.08em] uppercase text-faint shrink-0 ml-3">{headerRight}</span>
      </div>

      {hasPages ? (
        <div className="max-h-[540px] overflow-auto bg-[#f4f2ec]">
          {pages.map((pg, pi) => (
            <div key={pi} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pg.image} alt={`page ${pi + 1}`} className="w-full block select-none" draggable={false} />
              {(fields ?? []).flatMap((f, fi) =>
                f.boxes.filter((b) => b.page === pi).map((b, bi) => {
                  const c = CAT_COLOR[f.category] ?? CAT_COLOR.Other;
                  const on = hot === fi;
                  return (
                    <div key={`${fi}-${bi}`} data-box onMouseEnter={() => setHot(fi)} onMouseLeave={() => setHot(null)}
                      className="absolute cursor-pointer rounded-[2px]"
                      style={{
                        left: `${b.box[0] * 100}%`, top: `${b.box[1] * 100}%`,
                        width: `${(b.box[2] - b.box[0]) * 100}%`, height: `${(b.box[3] - b.box[1]) * 100}%`,
                        border: `1.5px solid ${on ? c : `${c}99`}`,
                        background: on ? `${c}30` : "transparent",
                        boxShadow: on ? `0 0 0 2px ${c}66` : "none",
                        opacity: revealed ? 1 : 0, pointerEvents: revealed ? "auto" : "none",
                        transition: "opacity .2s, background .12s, border-color .12s, box-shadow .12s",
                      }} />
                  );
                }))}
            </div>
          ))}
        </div>
      ) : mode === "upload" ? (
        <label className="flex flex-col items-center justify-center text-center gap-2 min-h-[300px] px-6 cursor-pointer text-muted">
          <input type="file" accept="application/pdf" hidden
            onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          <div className="size-11 rounded-xl border border-dashed border-line flex items-center justify-center text-[19px] text-faint">↑</div>
          {file
            ? <b className="text-text text-[14px]">{file.name}</b>
            : <span className="text-[13.5px]"><b className="text-text">Drop a PDF</b>, or click to browse · ≤ 10 MB</span>}
          <span className="text-[11.5px] text-faint">Processed to extract terms, then discarded — your file is not stored.</span>
        </label>
      ) : (
        <div className="flex items-center justify-center min-h-[300px] text-[13px] text-faint font-mono">
          {loading ? "rendering the document…" : "select a contract to read it here"}
        </div>
      )}
    </div>
  );
}
