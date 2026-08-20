"use client";
import { useState } from "react";
import { submitLead } from "@/lib/playground-api";

export function EmailGate({ open, onClose, onSubmitted, context }:
  { open: boolean; onClose: () => void; onSubmitted: (t: string) => void; context: Record<string, unknown> }) {
  const [email, setEmail] = useState(""); const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  if (!open) return null;
  async function go() {
    setBusy(true); setErr("");
    try { const { session_token } = await submitLead(email, company, context); onSubmitted(session_token); }
    catch (e) { setErr(e instanceof Error ? e.message : "try again"); } finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-5 bg-[rgba(9,20,28,.55)] backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-[min(440px,100%)] rounded-2xl bg-panel border border-line p-7 shadow-2xl">
        <h3 className="text-xl font-semibold tracking-tight">See how models read your contract</h3>
        <p className="mt-1.5 text-[14px] text-muted">Enter your work email to run extraction on your own document.</p>
        <label className="block font-mono text-[10.5px] uppercase tracking-wide text-faint mt-4 mb-1.5">Work email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
          className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-[14px]" />
        <label className="block font-mono text-[10.5px] uppercase tracking-wide text-faint mt-3 mb-1.5">Company</label>
        <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Inc."
          className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-[14px]" />
        {err && <p className="mt-2 text-[12.5px] text-warning">{err}</p>}
        <button disabled={busy} onClick={go}
          className="mt-4 w-full rounded-xl bg-navy text-bg py-3 text-[14px] font-bold disabled:opacity-60">
          {busy ? "Running…" : "Run extraction →"}</button>
        <p className="mt-3 text-[11.5px] text-faint text-center">We&rsquo;ll only use this to follow up about FinePrint. Your file is not stored.</p>
      </div>
    </div>
  );
}
