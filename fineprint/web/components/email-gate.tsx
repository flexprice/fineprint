"use client";
// The gate in front of running your OWN contract. The form itself is hosted on Zite and framed
// here; it collects the lead, calls FinePrint's /lead server-side (which is what posts to Slack
// and records the row), and hands the resulting session token back over postMessage. That token
// is what POST /extract requires for the upload path.
//
// Trust boundary: event.origin is the whole of it. Anything that isn't exactly GATE_ORIGIN is
// ignored, because a token accepted from any other frame would be an unauthenticated bypass of
// this gate. Never widen this to a prefix match or to "*".
import { useEffect, useState } from "react";

const GATE_ORIGIN = process.env.NEXT_PUBLIC_FINEPRINT_GATE_ORIGIN ?? "https://6rrf1mjptc.zite.so";

type GateMessage = { source: "fineprint-gate"; ok: boolean; sessionToken?: unknown; reason?: unknown };

function isGateMessage(d: unknown): d is GateMessage {
  return !!d && typeof d === "object" && (d as { source?: unknown }).source === "fineprint-gate";
}

export function EmailGate({ open, onClose, onSubmitted, context }:
  { open: boolean; onClose: () => void; onSubmitted: (t: string) => void; context: Record<string, unknown> }) {
  const [err, setErr] = useState("");
  // The framed form reads ?model= and forwards it to /lead, so the Slack line names the model
  // instead of reading "ran a contract on None". Model ids are public — fine in a URL.
  const model = typeof context.model === "string" ? context.model : "";
  const src = model ? `${GATE_ORIGIN}/?model=${encodeURIComponent(model)}` : `${GATE_ORIGIN}/`;

  useEffect(() => {
    if (!open) return;               // only listen while the gate is actually up
    setErr("");
    function onMessage(e: MessageEvent) {
      if (e.origin !== GATE_ORIGIN) return;          // the entire trust boundary — see above
      if (!isGateMessage(e.data)) return;
      if (e.data.ok && typeof e.data.sessionToken === "string" && e.data.sessionToken) {
        onSubmitted(e.data.sessionToken);
        return;
      }
      setErr(typeof e.data.reason === "string" && e.data.reason
        ? e.data.reason
        : "That didn't go through. Try again.");
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [open, onSubmitted]);

  // Esc closes, matching the click-outside affordance below.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Run your own contract"
      className="fixed inset-0 z-40 flex items-center justify-center p-5 bg-[rgba(9,20,28,.55)] backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-[min(440px,100%)] rounded-2xl bg-surface border border-line shadow-2xl overflow-hidden">
        <iframe
          src={src}
          title="Run your own contract"
          className="w-full h-[560px] max-h-[78vh] block border-0 bg-surface"
          // The frame is cross-origin, so it is already isolated; this keeps it to what the
          // form actually needs and denies navigation of the top window.
          sandbox="allow-scripts allow-forms allow-same-origin"
        />
        {err && <p className="px-6 pb-4 -mt-1 text-[12.5px] text-warning text-center">{err}</p>}
      </div>
    </div>
  );
}
