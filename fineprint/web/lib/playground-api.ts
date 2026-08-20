// fineprint/web/lib/playground-api.ts
const API = process.env.NEXT_PUBLIC_FINEPRINT_API ?? "https://fineprint-wo5ok35f7q-uc.a.run.app";

export type Box = { page: number; box: [number, number, number, number] };
export type Field = { field: string; value: string; confidence: string; category: string; boxes: Box[] };
export type ExtractResult = { pages: { image: string; w: number; h: number }[]; fields: Field[]; model: string; latency: number };

export async function submitLead(email: string, company: string, context: Record<string, unknown>) {
  const r = await fetch(`${API}/lead`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, company, context }),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail ?? "lead failed");
  return (await r.json()) as { session_token: string };
}

export async function runExtract(opts:
  | { sampleId: string; model: string }
  | { file: File; model: string; sessionToken: string }): Promise<ExtractResult> {
  let res: Response;
  if ("sampleId" in opts) {
    res = await fetch(`${API}/extract`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ sample_id: opts.sampleId, model: opts.model }),
    });
  } else {
    const fd = new FormData();
    fd.append("file", opts.file); fd.append("model", opts.model); fd.append("session_token", opts.sessionToken);
    res = await fetch(`${API}/extract`, { method: "POST", body: fd });
  }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail ?? `extract failed (${res.status})`);
  return (await res.json()) as ExtractResult;
}
