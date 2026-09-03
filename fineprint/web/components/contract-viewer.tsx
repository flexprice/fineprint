"use client";
// Left half of the Try-it section: the contract itself, in a scrollable window. The page
// image(s) show as soon as a sample is picked (before any run) so the document can be read.
// Once a run reveals results, every field's citation box is drawn over the page; hovering a
// box lights up its row in the OutputPanel (shared `hot`), and vice-versa. While a run is in
// flight, a scanner sweep animates over the document so a 30–80s extraction reads as "working".
import dynamic from "next/dynamic";
import type { Page, Field } from "@/lib/playground-api";
import { CAT_COLOR, PANEL_H } from "@/lib/categories";

// Lazy: keeps lottie-web and the animation JSON out of the initial bundle. The fallback is the
// plain label this replaced, so the panel reads the same in the instant before the chunk lands.
const DocumentLoader = dynamic(() => import("@/components/document-loader"), {
  ssr: false,
  // Empty, not a label: the chunk lands in a blink and a word that flashes by is worse than
  // nothing. The panel is a fixed height, so this holds the space either way.
  loading: () => <div className="h-full" />,
});

export function ContractViewer({
  pages, fields, revealed, hot, setHot, mode, file, onFile, loading, running, source,
}: {
  pages: Page[]; fields: Field[]; revealed: boolean;
  hot: number | null; setHot: (i: number | null) => void;
  mode: "sample" | "upload"; file: File | null; onFile: (f: File | null) => void;
  loading: boolean; running: boolean; source: string;
}) {
  // In upload mode the drop zone owns this panel until results land — a sample preview that
  // resolves late must never paint a contract over it. Once revealed, though, the pages ARE
  // the user's own uploaded document (rendered by /extract), so they must show.
  const hasPages = pages.length > 0 && (mode !== "upload" || revealed);
  const headerLeft = mode === "upload" && !hasPages ? "Your document" : source;
  const headerRight = running ? "scanning…" : revealed ? `${fields.length} fields cited` : hasPages ? "scroll to read ↓" : "";

  return (
    <div className={`panel rounded-2xl overflow-hidden flex flex-col ${PANEL_H}`}>
      <div className="shrink-0 px-3.5 py-2.5 flex items-center justify-between border-b border-line bg-surface-2">
        <span className="font-mono text-[10px] tracking-[.08em] uppercase text-faint truncate">{headerLeft}</span>
        <span className={`font-mono text-[10px] tracking-[.08em] uppercase shrink-0 ml-3 ${running ? "text-accent" : "text-faint"}`}>{headerRight}</span>
      </div>

      {/* Takes whatever the fixed-height shell has left over, and scrolls inside it — so the
          document, the OCR skeleton, the drop zone and the empty state are all the same size. */}
      <div className="relative flex-1 min-h-0">
        {hasPages ? (
          <>
            <div className="h-full overflow-auto bg-[#f4f2ec]">
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
                            opacity: revealed && !running ? 1 : 0, pointerEvents: revealed && !running ? "auto" : "none",
                            transition: "opacity .2s, background .12s, border-color .12s, box-shadow .12s",
                          }} />
                      );
                    }))}
                </div>
              ))}
            </div>
            {running && <div className="fp-scanline" aria-hidden />}
          </>
        ) : running ? (
          <ScanSkeleton label="Running OCR on your document…" />
        ) : mode === "upload" ? (
          <label className="flex flex-col items-center justify-center text-center gap-2 h-full px-6 cursor-pointer text-muted">
            <input type="file" accept="application/pdf" hidden
              onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
            <div className="size-11 rounded-xl border border-dashed border-line flex items-center justify-center text-[19px] text-faint">↑</div>
            {file
              ? <b className="text-text text-[14px]">{file.name}</b>
              : <span className="text-[13.5px]"><b className="text-text">Drop a PDF</b>, or click to browse · ≤ 10 MB</span>}
            <span className="text-[11.5px] text-faint">Processed to extract terms, then discarded — your file is not stored.</span>
          </label>
        ) : (
          loading ? (
            <DocumentLoader />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 h-full px-6 text-center">
              <span className="text-[13px] text-muted">Page preview didn&rsquo;t load for this contract.</span>
              <span className="text-[12px] text-faint">Run extraction still works — the pages appear with the results.</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// Placeholder shown while an uploaded document is OCR'ing (no page render yet): a shimmering
// "sheet" with a scanner sweep, so the wait reads as progress.
function ScanSkeleton({ label }: { label: string }) {
  return (
    <div className="relative h-full bg-[#f4f2ec] p-6 overflow-hidden">
      <div className="mx-auto max-w-[440px] rounded-lg bg-white shadow-sm p-6 flex flex-col gap-3">
        <div className="fp-shimmer h-4 w-1/2 mx-auto" />
        <div className="h-2" />
        {[92, 84, 96, 70, 88, 60, 90, 78].map((w, i) => (
          <div key={i} className="fp-shimmer h-2.5" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="fp-scanline" aria-hidden />
      <div className="absolute bottom-3 left-0 right-0 text-center font-mono text-[11px] text-accent">{label}</div>
    </div>
  );
}
