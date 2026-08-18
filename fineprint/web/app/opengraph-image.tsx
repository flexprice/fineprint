import { ImageResponse } from "next/og";
import { newest, data, money, BASELINE_LABEL } from "@/lib/data";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "FinePrint: the document-extraction benchmark";

export default function OpengraphImage() {
  const m = newest();
  const delta = data.baseline_acc != null ? +(m.accuracy - data.baseline_acc).toFixed(1) : null;
  const kpis: [string, string][] = [
    [`${m.accuracy}%`, "accuracy"],
    [`${m.halluc}%`, "hallucinated"],
    [`${money(m.cost_1k)}`, "per 1k"],
    [`${m.p50}s`, "p50 latency"],
  ];
  const mono = 'ui-monospace, "SF Mono", Menlo, monospace';

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#0a0e1a", color: "#f2eee1", padding: 64, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 10, background: "#e84e1f", fontSize: 22, fontFamily: mono, color: "#fff", fontWeight: 600 }}>F</div>
          <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: -0.5 }}>FinePrint</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 15, letterSpacing: 3, color: "#f15a2b", fontFamily: mono }}>NEW MODEL SCORED · CONTRACT EXTRACTION</div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 14 }}>
            <div style={{ fontSize: 68, fontWeight: 700, letterSpacing: -2, color: "#f2eee1" }}>{m.label}</div>
            <div style={{ display: "flex", fontSize: 17, color: "#656a72", fontFamily: mono }}>{m.family}</div>
            <div style={{ display: "flex", fontSize: 15, fontWeight: 600, color: "#fff", background: "#e84e1f", borderRadius: 999, padding: "6px 14px" }}>NEW</div>
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#9299a3", marginTop: 20 }}>
            Ranked #{m.rank} of {data.n_models} on reading a contract into billing data
            {delta != null ? `  ·  ${delta >= 0 ? "+" : ""}${delta} pts vs ${BASELINE_LABEL}` : ""}
          </div>
        </div>

        <div style={{ display: "flex", gap: 30, borderTop: "1px solid #23252a", paddingTop: 30 }}>
          {kpis.map(([v, k]) => (
            <div key={k} style={{ display: "flex", flexDirection: "column", width: 250 }}>
              <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: -1 }}>{v}</div>
              <div style={{ display: "flex", fontSize: 14, letterSpacing: 1.5, color: "#656a72", fontFamily: mono, marginTop: 6, textTransform: "uppercase" }}>{k}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", color: "#656a72", fontSize: 15, fontFamily: mono }}>
          <div style={{ display: "flex" }}>flexprice · fineprint</div>
          <div style={{ display: "flex" }}>{data.fields_per_contract} fields / contract · {data.n_runs} runs · private holdout</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
