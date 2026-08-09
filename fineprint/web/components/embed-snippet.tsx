"use client";

import { useState } from "react";

const SNIPPET = `<iframe src="https://fineprint.bench/embed" width="100%" height="480" style="border:1px solid #23252a;border-radius:12px"></iframe>`;

// "Embed" affordance for the home leaderboard — reveals the iframe snippet for copy.
export function EmbedSnippet() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — the snippet is still selectable */
    }
  };

  return (
    <div className="relative">
      <button className="btn btn-ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
        </svg>
        Embed
      </button>
      {open && (
        <div className="panel absolute right-0 z-30 mt-2 w-[min(92vw,440px)] p-3" style={{ boxShadow: "0 12px 36px rgba(0,0,0,.28)" }}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="font-mono text-[11px] text-faint">Drop this on any site</span>
            <button onClick={copy} className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }}>
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <pre className="mono overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-surface-2 p-3 text-[11.5px] leading-relaxed text-muted">
            {SNIPPET}
          </pre>
        </div>
      )}
    </div>
  );
}
