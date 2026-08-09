import { models, data, money } from "@/lib/data";
import { ProviderIcon } from "@/components/provider-icon";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://fineprint.bench";

// Compact, standalone leaderboard sized to read cleanly at ~520px wide inside an iframe.
export default function EmbedPage() {
  const rows = [...models].sort((a, b) => a.rank - b.rank);

  return (
    <div className="card overflow-hidden mx-auto" style={{ maxWidth: 640 }}>
      <header className="flex items-center gap-2.5 border-b border-line px-4 py-3">
        <span className="grid place-items-center rounded-md font-mono font-semibold text-white"
          style={{ width: 20, height: 20, background: "var(--primary-strong)", fontSize: 10 }}>
          F
        </span>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold tracking-tight">FinePrint</div>
          <div className="font-mono text-[10px] text-faint">contract-extraction benchmark</div>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[10px] text-muted">
          <span className="size-1.5 rounded-full" style={{ background: "var(--success)" }} />
          {data.n_models} models · {data.n_contracts} contracts
        </span>
      </header>

      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-[.06em] text-faint">#</th>
            <th className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-[.06em] text-faint">Model</th>
            <th className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[.06em] text-faint">Acc.</th>
            <th className="px-2 py-2 text-right font-mono text-[10px] uppercase tracking-[.06em] text-faint">$/1k</th>
            <th className="px-4 py-2 text-right font-mono text-[10px] uppercase tracking-[.06em] text-faint">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className="border-t border-line">
              <td className="px-4 py-2.5 text-left font-mono text-faint tnum">{m.rank}</td>
              <td className="px-2 py-2.5 text-left">
                <span className="flex items-center gap-2">
                  <ProviderIcon brand={m.brand} size={14} />
                  <b className="font-semibold">{m.label}</b>
                  {m.new && <span className="badge badge-new" style={{ padding: "0px 6px", fontSize: 10 }}>new</span>}
                </span>
              </td>
              <td className="px-2 py-2.5 text-right tnum">{m.accuracy}%</td>
              <td className="px-2 py-2.5 text-right tnum">{money(m.cost_1k)}</td>
              <td className="px-4 py-2.5 text-right tnum">{m.value >= 10 ? m.value.toFixed(0) : m.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="flex items-center justify-between border-t border-line px-4 py-2.5">
        <span className="font-mono text-[10px] text-faint">accuracy = % fields correct · value = pts per $/1k</span>
        <a href={SITE} target="_blank" rel="noopener noreferrer"
          className="font-mono text-[11px] font-medium text-accent hover:underline">
          FinePrint by Flexprice ↗
        </a>
      </footer>
    </div>
  );
}
