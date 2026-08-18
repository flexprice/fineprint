"use client";

import { useState } from "react";
import sampleData from "@/lib/sample.json";

// Real extraction over a real public contract (a Web Hosting Agreement filed as a public SEC
// exhibit; CUAD, CC BY 4.0). Page image + the model's actual field bounding boxes — nothing faked.
type Field = { field: string; value: string; confidence: string; category: string; boxes: number[][] };
const sample = sampleData as { image: string; source: string; fields: Field[] };

const CAT_COLOR: Record<string, string> = {
  Identity: "#7b84e6", Customer: "#5aa9c9", "Platform Fee": "#33b39c", "Hosting": "#e08a3c",
  "LLM Usage": "#b06fd0", "Credit Grant": "#33a06a", Entitlement: "#3aa6e0",
  Override: "#d081a8", Commitment: "#e06a6a", Terms: "#98a0ab", Other: "#98a0ab",
};

export function AnnotatedContract() {
  const [active, setActive] = useState<number | null>(null);

  return (
    // The contract is the exhibit, so it takes the larger share, but the schema still
    // needs enough width to read. minmax(0,…) is load-bearing: the schema rows use
    // `truncate` (white-space: nowrap), so their min-content width is the full
    // untruncated string. A bare `1fr` floors at that and starves the contract.
    <div className="grid lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] gap-5 items-start">
      {/* the real contract page + the model's overlay */}
      <div className="rounded-xl overflow-hidden border border-line-2 bg-white">
        <div className="flex items-center justify-between px-4 py-2 bg-[#eef0f2] border-b border-[#dfe1e5]">
          <span className="font-mono text-[10.5px] tracking-[.1em] uppercase text-[#5f6570]">Real contract · public SEC exhibit</span>
          <span className="font-mono text-[10.5px] text-[#9096a0]">Web Hosting Agreement</span>
        </div>
        {/* No max-height: the page used to be cut off mid-document and scrolled inside
            its own box, so you never saw the whole contract at once. */}
        <div className="relative bg-white">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sample.image} alt="Contract page" className="w-full block select-none" draggable={false} />
            {sample.fields.map((f, i) =>
              f.boxes.map((b, j) => {
                const on = active === i;
                const c = CAT_COLOR[f.category] ?? "#98a0ab";
                return (
                  <div
                    key={`${i}-${j}`}
                    onMouseEnter={() => setActive(i)}
                    onMouseLeave={() => setActive(null)}
                    className="absolute cursor-pointer"
                    style={{
                      left: `${b[0] * 100}%`, top: `${b[1] * 100}%`,
                      width: `${(b[2] - b[0]) * 100}%`, height: `${(b[3] - b[1]) * 100}%`,
                      border: `1.5px solid ${on ? c : `${c}99`}`,
                      background: on ? `${c}30` : "transparent",
                      boxShadow: on ? `0 0 0 2px ${c}66` : "none",
                      borderRadius: 2, transition: "all .12s",
                    }}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* extracted structured fields */}
      <div className="card rounded-xl p-1.5">
        <div className="px-3.5 py-2.5 flex items-center justify-between">
          <span className="font-mono text-[10.5px] tracking-[.1em] uppercase text-faint">Extracted billing schema</span>
          <span className="font-mono text-[10.5px] text-faint">{sample.fields.length} fields</span>
        </div>
        <div className="flex flex-col">
          {sample.fields.map((f, i) => {
            const on = active === i;
            const c = CAT_COLOR[f.category] ?? "#98a0ab";
            return (
              <button
                key={f.field}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                className="text-left px-3.5 py-2.5 border-t border-line flex items-center gap-3 transition-colors"
                style={{ background: on ? "var(--surface-2)" : "transparent" }}
              >
                <span className="size-2 rounded-[3px] shrink-0" style={{ background: c }} />
                <span className="text-[11.5px] text-muted w-[142px] shrink-0 truncate">{f.field}</span>
                <span className="text-[13px] tnum truncate flex-1">{f.value}</span>
                <span className={`font-mono text-[9.5px] tracking-wide shrink-0 ${f.confidence === "HIGH" ? "text-faint" : "text-warning"}`}>
                  {f.confidence === "HIGH" ? "HIGH" : "REVIEW"}
                </span>
              </button>
            );
          })}
        </div>
        <p className="px-3.5 py-2.5 text-[11px] text-faint border-t border-line">
          Every box is the model&rsquo;s own citation. Hover a field to see where it read it.
        </p>
      </div>
    </div>
  );
}
