// fineprint/web/components/playground.tsx
"use client";
import { useState } from "react";
import samples from "@/lib/playground-samples.json";
import { runExtract, type ExtractResult } from "@/lib/playground-api";
import { AnnotatedResult } from "@/components/annotated-result";
import { EmailGate } from "@/components/email-gate";

const CURATED = [
  { id: "gpt-5.5", label: "GPT-5.5 — #1 · 82.2%" },
  { id: "claude-fable-5", label: "Claude Fable 5 — #2 · 81.8%" },
  { id: "grok-4.6", label: "Grok 4.6 — #3 · 80.7%" },
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite — best value" },
  { id: "gpt-5.6-luna", label: "GPT-5.6 Luna — fastest" },
  { id: "deepseek-v3.2", label: "DeepSeek V3.2 — #19" },
];

export function Playground() {
  const [tab, setTab] = useState<"sample" | "upload">("sample");
  const [sampleId, setSampleId] = useState(samples[0].id);
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState(CURATED[0].id);
  const [token, setToken] = useState<string | null>(null);
  const [gate, setGate] = useState(false);
  const [status, setStatus] = useState<"" | "running" | "error">("");
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [err, setErr] = useState("");

  async function run(tokenOverride?: string) {
    if (tab === "upload") {
      if (!file) { setErr("Choose a PDF first."); return; }
      const activeToken = tokenOverride ?? token;
      if (!activeToken) { setGate(true); return; }         // gate only when we truly have no token
      setStatus("running"); setErr("");
      try {
        const res = await runExtract({ file: file!, model, sessionToken: activeToken });
        setResult(res); setStatus("");
      } catch (e) { setErr(e instanceof Error ? e.message : "failed"); setStatus("error"); }
      return;
    }
    setStatus("running"); setErr("");
    try {
      const res = await runExtract({ sampleId, model });
      setResult(res); setStatus("");
    } catch (e) { setErr(e instanceof Error ? e.message : "failed"); setStatus("error"); }
  }

  return (
    <div>
      <div className="panel rounded-2xl p-5 mb-6">
        <div className="flex gap-1 bg-surface-2 rounded-xl p-1 w-max mb-4">
          {(["sample", "upload"] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setErr(""); }}
              className={`px-4 py-1.5 rounded-lg text-[13.5px] font-semibold ${tab === t ? "bg-surface text-text shadow-sm" : "text-muted"}`}>
              {t === "sample" ? "Sample contracts" : "Upload your own"}</button>
          ))}
        </div>
        {tab === "sample" ? (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {samples.map((s) => (
              <button key={s.id} onClick={() => { setSampleId(s.id); setErr(""); }}
                className={`text-left border rounded-xl p-3.5 ${sampleId === s.id ? "border-accent bg-accent/5" : "border-line"}`}>
                <div className="text-[14px] font-semibold">{s.title}</div>
                <div className="font-mono text-[11px] text-faint mt-1">{s.source}</div>
              </button>
            ))}
          </div>
        ) : (
          <label className="block border border-dashed border-line rounded-xl p-8 text-center text-muted cursor-pointer">
            <input type="file" accept="application/pdf" hidden
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setErr(""); }} />
            {file ? <b className="text-text">{file.name}</b> : <><b className="text-text">Drop a PDF</b>, or click to browse · ≤ 10 MB</>}
            <div className="text-[12px] text-faint mt-2">Your file is processed to extract terms and is not stored.</div>
          </label>
        )}
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-line-2">
          <select value={model} onChange={(e) => setModel(e.target.value)}
            className="border border-line bg-surface rounded-lg px-3 py-2 text-[13.5px] font-semibold">
            {CURATED.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <button onClick={() => run()} disabled={status === "running"}
            className="ml-auto bg-primary text-bg rounded-xl px-5 py-2.5 text-[14px] font-bold disabled:opacity-60">
            {status === "running" ? "Reading…" : "Run extraction →"}</button>
        </div>
        {err && <p className="mt-3 text-[13px] text-warning">{err}</p>}
      </div>

      {status === "running" && <p className="text-center text-muted text-[14px] py-10 font-mono">OCR&rsquo;ing → reading → rendering…</p>}
      {result && <AnnotatedResult result={result} />}

      <EmailGate open={gate} onClose={() => setGate(false)}
        context={{ kind: "upload", model, sample: null }}
        onSubmitted={(t) => { setToken(t); setGate(false); run(t); }} />
    </div>
  );
}
