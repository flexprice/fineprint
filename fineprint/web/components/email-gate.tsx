"use client";
import { useState } from "react";
import { submitLead } from "@/lib/playground-api";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function EmailGate({ open, onClose, onSubmitted, context }:
  { open: boolean; onClose: () => void; onSubmitted: (t: string) => void; context: Record<string, unknown> }) {
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  if (!open) return null;
  const ready = name.trim().length > 0 && EMAIL_RE.test(email.trim());
  async function go() {
    if (!ready) { setErr("Enter your name and a valid work email."); return; }
    setBusy(true); setErr("");
    try { const { session_token } = await submitLead(name.trim(), email.trim(), context); onSubmitted(session_token); }
    catch (e) { setErr(e instanceof Error ? e.message : "try again"); } finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-5 bg-[rgba(9,20,28,.55)] backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-[min(440px,100%)] rounded-2xl bg-surface border border-line p-7 shadow-2xl">
        <h3 className="text-xl font-semibold tracking-tight">See how models read your contract</h3>
        <p className="mt-1.5 text-[14px] text-muted">Tell us who you are and we&rsquo;ll run extraction on your own document.</p>
        <label className="block font-mono text-[10.5px] uppercase tracking-wide text-faint mt-4 mb-1.5">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" autoFocus
          className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-[14px]" />
        <label className="block font-mono text-[10.5px] uppercase tracking-wide text-faint mt-3 mb-1.5">Work email</label>
        <input value={email} type="email" onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
          onKeyDown={(e) => { if (e.key === "Enter" && ready) go(); }}
          className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-[14px]" />
        {err && <p className="mt-2 text-[12.5px] text-warning">{err}</p>}
        <button disabled={busy || !ready} onClick={go}
          className="mt-4 w-full rounded-xl bg-primary text-bg py-3 text-[14px] font-bold disabled:opacity-50 disabled:cursor-not-allowed">
          {busy ? "Running…" : "Run extraction"}</button>
        <p className="mt-3 text-[11.5px] text-faint text-center">We&rsquo;ll only use this to follow up about FinePrint. Your file is not stored.</p>
      </div>
    </div>
  );
}
