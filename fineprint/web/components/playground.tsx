// fineprint/web/components/playground.tsx
"use client";
import { useEffect, useRef, useState } from "react";
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
// Team feedback: MSA reads cleaner as the first thing people see than the license agreement.
const DEFAULT_SAMPLE_ID = "msa";

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

// The backend caches extractions, so a repeat run can come back in about a second while
// still reporting the latency of the real model call. Revealing instantly under a "read in
// 44.2s" label reads as fake, so hold the running state until the wall clock matches the
// number we are about to put on screen — but never longer than this. A slow model's true
// latency is most of a minute, and nobody should be made to sit through it to see the demo.
const MAX_HOLD_MS = 10_000;
function holdForReportedLatency(startedAt: number, latencySeconds: number) {
  const target = Math.min(Math.max(latencySeconds, 0) * 1000, MAX_HOLD_MS);
  const remaining = target - (performance.now() - startedAt);
  return remaining > 0 ? new Promise((r) => setTimeout(r, remaining)) : Promise.resolve();
}

export function Playground() {
  const [mode, setMode] = useState<"sample" | "upload">("sample");
  const [sampleId, setSampleId] = useState(DEFAULT_SAMPLE_ID);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [file, setFile] = useState<File | null>(null);
  const isGuidewireDefault = DEFAULT_SAMPLE_ID === GUIDEWIRE_ID;
  const [pages, setPages] = useState<Page[]>(isGuidewireDefault ? GUIDEWIRE.pages : []);
  const [result, setResult] = useState<ExtractResult | null>(isGuidewireDefault ? GUIDEWIRE : null);
  const [revealed, setRevealed] = useState(false);
  const [hot, setHot] = useState<number | null>(null);
  const [loadingPages, setLoadingPages] = useState(!isGuidewireDefault);
  const [status, setStatus] = useState<"" | "running" | "error">("");
  const [err, setErr] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [gate, setGate] = useState(false);
  // Bumped on every pick. Previews and extractions capture it and drop their results if the
  // user has since chosen something else — otherwise a slow sample preview lands on top of
  // whatever is on screen now (most visibly: a contract painted over the upload drop zone).
  const reqId = useRef(0);
  // Always show every sample chip from the catalog. Guidewire works fully offline; the rest
  // need the playground API for page previews / extraction (empty preview if the API is down).
  const catalog = samples as SampleMeta[];

  useEffect(() => {
    // Warm the availability probe so a live backend can serve previews; chips don't wait on it.
    fetchAvailableSamples().catch(() => {});
    if (!isGuidewireDefault) {
      const req = reqId.current;
      fetchSamplePages(DEFAULT_SAMPLE_ID)
        .then((p) => { if (reqId.current === req) setPages(p); })
        .catch(() => { if (reqId.current === req) setPages([]); })
        .finally(() => { if (reqId.current === req) setLoadingPages(false); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: default sample is a constant
  }, []);

  function pickSample(id: string) {
    const req = ++reqId.current;
    setMode("sample"); setSampleId(id); setRevealed(false); setHot(null); setErr(""); setStatus("");
    if (id === GUIDEWIRE_ID) { setPages(GUIDEWIRE.pages); setResult(GUIDEWIRE); setLoadingPages(false); return; }
    setResult(null); setPages([]); setLoadingPages(true);
    fetchSamplePages(id)
      .then((p) => { if (reqId.current === req) setPages(p); })
      .catch(() => { if (reqId.current === req) setPages([]); })  // preview may not be prepped yet; Run will still extract
      .finally(() => { if (reqId.current === req) setLoadingPages(false); });
  }

  function pickUpload() {
    // The bump is what keeps a sample preview that is still in flight from resolving a second
    // later and painting that contract over the drop zone.
    ++reqId.current;
    setMode("upload"); setRevealed(false); setHot(null); setErr(""); setStatus("");
    setResult(null); setPages([]); setLoadingPages(false);
  }

  async function run(tokenOverride?: string) {
    setErr("");
    if (mode === "sample") {
      const req = reqId.current;
      const startedAt = performance.now();
      setStatus("running");
      try {
        // Guidewire on the default model is the offline path: nothing to fetch, but it still
        // sits out its own reported latency so the number on screen is the wait you felt.
        const res = sampleId === GUIDEWIRE_ID && model === DEFAULT_MODEL
          ? GUIDEWIRE
          : await runExtract({ sampleId, model });
        await holdForReportedLatency(startedAt, res.latency);
        if (reqId.current !== req) return;
        setResult(res); setPages(res.pages); setRevealed(true); setStatus("");
      } catch (e) {
        if (reqId.current !== req) return;
        setErr(e instanceof Error ? e.message : "extraction failed"); setStatus("error");
      }
      return;
    }
    // upload — gated on a work email
    if (!file) { setErr("Choose a PDF first."); return; }
    const activeToken = tokenOverride ?? token;
    if (!activeToken) { setGate(true); return; }
    const req = reqId.current;
    const startedAt = performance.now();
    setStatus("running");
    try {
      const res = await runExtract({ file, model, sessionToken: activeToken });
      await holdForReportedLatency(startedAt, res.latency);
      if (reqId.current !== req) return;
      setResult(res); setPages(res.pages); setRevealed(true); setStatus("");
    } catch (e) {
      if (reqId.current !== req) return;
      setErr(e instanceof Error ? e.message : "extraction failed"); setStatus("error");
    }
  }

  const running = status === "running";
  const row1 = catalog.slice(0, 3);
  const row2 = catalog.slice(3);

  const chip = (s: SampleMeta) => (
    <button key={s.id} onClick={() => pickSample(s.id)}
      className={`text-[12.5px] px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
        mode === "sample" && sampleId === s.id
          ? "border-accent bg-accent/5 text-text font-semibold"
          : "border-line bg-surface text-muted hover:text-text"}`}>
      {s.title}</button>
  );

  return (
    <div>
      <div className="mb-6 space-y-4">
        <div className="space-y-2.5 min-w-0">
          <div className="flex flex-wrap gap-2">{row1.map(chip)}</div>
          <div className="flex flex-wrap gap-2">
            {row2.map(chip)}
            <button onClick={pickUpload}
              className={`text-[12.5px] px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
                mode === "upload"
                  ? "border-accent bg-accent/5 text-text font-semibold"
                  : "border-line bg-surface text-muted hover:text-text"}`}>
              Upload your own</button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2.5 w-full">
          <ModelPicker ids={PLAYGROUND_MODEL_IDS} value={model} onChange={setModel} />
          <button onClick={() => run()} disabled={running}
            className="bg-primary text-bg rounded-xl px-5 py-2.5 text-[13.5px] font-bold disabled:opacity-60 whitespace-nowrap w-full sm:w-auto">
            {running ? "Reading…" : revealed ? "Re-run" : "Run extraction"}</button>
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
