// fineprint/web/components/playground.tsx
"use client";
import { useEffect, useState } from "react";
import samples from "@/lib/playground-samples.json";
import sample from "@/lib/sample.json";
import { runExtract, fetchSamplePages, fetchAvailableSamples,
  type ExtractResult, type Page, type SampleMeta } from "@/lib/playground-api";
import { ContractViewer } from "@/components/contract-viewer";
import { OutputPanel } from "@/components/output-panel";
import { ModelPicker } from "@/components/model-picker";
import { EmailGate } from "@/components/email-gate";
import { byId } from "@/lib/data";

// Shortlist offered in the playground (ids match the backend PLAYGROUND_MODELS). Names + logos
// are resolved from the published board (lib/data) inside ModelPicker — no rank/price here.
const PLAYGROUND_MODEL_IDS = ["gpt-5.5", "claude-fable-5", "grok-4.6", "gemini-3.5-flash-lite", "gpt-5.6-luna", "deepseek-v3.2"];
const DEFAULT_MODEL = PLAYGROUND_MODEL_IDS[0];
const GUIDEWIRE_ID = samples[0].id; // "guidewire"
const GUIDEWIRE_META = samples.find((s) => s.id === GUIDEWIRE_ID)! as SampleMeta;

// The one sample that ships with the site as a static asset, adapted into the /extract shape
// so the same viewer renders it. This is the default view — no network, always works.
const GUIDEWIRE: ExtractResult = {
  pages: [{ image: sample.image, w: 0, h: 0 }],
  fields: sample.fields.map((f) => ({
    field: f.field, value: f.value, confidence: f.confidence, category: f.category,
    boxes: f.boxes.map((b) => ({ page: 0, box: b as [number, number, number, number] })),
  })),
  model: "GPT-5.5", latency: 41,
};

const sourceOf = (id: string) => {
  const s = samples.find((x) => x.id === id);
  return s ? `${s.type} · ${s.source}` : "Contract";
};

export function Playground() {
  const [mode, setMode] = useState<"sample" | "upload">("sample");
  const [sampleId, setSampleId] = useState(GUIDEWIRE_ID);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<Page[]>(GUIDEWIRE.pages);
  const [result, setResult] = useState<ExtractResult | null>(GUIDEWIRE);
  const [revealed, setRevealed] = useState(false);
  const [hot, setHot] = useState<number | null>(null);
  const [loadingPages, setLoadingPages] = useState(false);
  const [status, setStatus] = useState<"" | "running" | "error">("");
  const [err, setErr] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [gate, setGate] = useState(false);
  // Chips render only genuinely-available samples: the offline Guidewire, plus whatever the
  // backend reports as prepped. No dead placeholder buttons.
  const [available, setAvailable] = useState<SampleMeta[]>([GUIDEWIRE_META]);

  useEffect(() => {
    fetchAvailableSamples()
      .then((list) => setAvailable([GUIDEWIRE_META, ...list.filter((s) => s.id !== GUIDEWIRE_ID)]))
      .catch(() => {});   // backend down / none prepped → just the offline Guidewire
  }, []);

  function pickSample(id: string) {
    setMode("sample"); setSampleId(id); setRevealed(false); setHot(null); setErr(""); setStatus("");
    if (id === GUIDEWIRE_ID) { setPages(GUIDEWIRE.pages); setResult(GUIDEWIRE); return; }
    setResult(null); setPages([]); setLoadingPages(true);
    fetchSamplePages(id)
      .then((p) => setPages(p))
      .catch(() => setPages([]))          // preview may not be prepped yet; Run will still extract
      .finally(() => setLoadingPages(false));
  }

  function pickUpload() {
    setMode("upload"); setRevealed(false); setHot(null); setErr(""); setStatus("");
    setResult(null); setPages([]);
  }

  async function run(tokenOverride?: string) {
    setErr("");
    if (mode === "sample") {
      // Guidewire on the default model is the offline path: nothing to fetch, just reveal.
      if (sampleId === GUIDEWIRE_ID && model === DEFAULT_MODEL) {
        setResult(GUIDEWIRE); setPages(GUIDEWIRE.pages); setRevealed(true); return;
      }
      setStatus("running");
      try {
        const res = await runExtract({ sampleId, model });
        setResult(res); setPages(res.pages); setRevealed(true); setStatus("");
      } catch (e) { setErr(e instanceof Error ? e.message : "extraction failed"); setStatus("error"); }
      return;
    }
    // upload — gated on a work email
    if (!file) { setErr("Choose a PDF first."); return; }
    const activeToken = tokenOverride ?? token;
    if (!activeToken) { setGate(true); return; }
    setStatus("running");
    try {
      const res = await runExtract({ file, model, sessionToken: activeToken });
      setResult(res); setPages(res.pages); setRevealed(true); setStatus("");
    } catch (e) { setErr(e instanceof Error ? e.message : "extraction failed"); setStatus("error"); }
  }

  const running = status === "running";

  return (
    <div>
      {/* controls: sample chips + upload + model + run */}
      <div className="flex flex-wrap items-center gap-2.5 mb-4">
        <div className="flex flex-wrap gap-2">
          {available.map((s) => (
            <button key={s.id} onClick={() => pickSample(s.id)}
              className={`text-[12.5px] px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
                mode === "sample" && sampleId === s.id
                  ? "border-accent bg-accent/5 text-text font-semibold"
                  : "border-line bg-surface text-muted hover:text-text"}`}>
              {s.title}</button>
          ))}
          <button onClick={pickUpload}
            className={`text-[12.5px] px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
              mode === "upload"
                ? "border-accent bg-accent/5 text-text font-semibold"
                : "border-line bg-surface text-muted hover:text-text"}`}>
            Upload your own ↑</button>
        </div>
        <div className="flex items-center gap-2.5 ml-auto">
          <ModelPicker ids={PLAYGROUND_MODEL_IDS} value={model} onChange={setModel} />
          <button onClick={() => run()} disabled={running}
            className="bg-primary text-bg rounded-xl px-5 py-2.5 text-[13.5px] font-bold disabled:opacity-60 whitespace-nowrap">
            {running ? "Reading…" : revealed ? "Re-run →" : "Run extraction →"}</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-4 items-start">
        <ContractViewer
          pages={pages} fields={result?.fields ?? []} revealed={revealed} running={running}
          hot={hot} setHot={setHot}
          mode={mode} file={file} onFile={(f) => { setFile(f); setErr(""); }}
          loading={loadingPages} source={mode === "upload" ? "Your document" : sourceOf(sampleId)} />
        <OutputPanel result={result} revealed={revealed} running={running}
          model={byId(model)?.label ?? model} hot={hot} setHot={setHot} />
      </div>

      {err && <p className="mt-3 text-[13px] text-warning">{err}</p>}

      <EmailGate open={gate} onClose={() => setGate(false)}
        context={{ kind: "upload", model, sample: null }}
        onSubmitted={(t) => { setToken(t); setGate(false); run(t); }} />
    </div>
  );
}
