type Row = {
  field: string;
  expected: string;
  predicted: string;
  result: "pass" | "pass-alt" | "fail" | "skip" | "soft";
  label: string;
};

const ROWS: Row[] = [
  { field: "recurring_fee.amount", expected: "25000", predicted: "25000", result: "pass", label: "Match" },
  { field: "recurring_fee.frequency", expected: "quarterly", predicted: "quarterly", result: "pass", label: "Match" },
  { field: "usage_fee.amount", expected: "180000 / yr", predicted: "45000 / qtr", result: "pass-alt", label: "Annualized" },
  { field: "recurring_fee.timing", expected: "advanced", predicted: "n/a", result: "fail", label: "Wrong" },
  { field: "fixed_fee.amount", expected: "0", predicted: "0", result: "skip", label: "Not scored" },
  { field: "scope_notes", expected: "“$250k capacity…”", predicted: "“annual usage…”", result: "soft", label: "Soft match" },
];

function ResultBadge({ result, label }: { result: Row["result"]; label: string }) {
  const tone =
    result === "pass" || result === "pass-alt" ? "fp-score-badge--pass"
    : result === "fail" ? "fp-score-badge--fail"
    : result === "soft" ? "fp-score-badge--soft"
    : "fp-score-badge--skip";
  return <span className={`fp-score-badge ${tone}`}>{label}</span>;
}

export function MethodologyFieldScoring({ nRuns }: { nRuns: number }) {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <p className="eyebrow mb-2">Example</p>
          <p className="text-[13.5px] text-muted max-w-[42ch]">One contract, a few fields from a single extraction run.</p>
        </div>
        <span className="font-mono text-[11px] text-faint">field-level rubric</span>
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[640px]">
          <thead>
            <tr>
              {(["Field", "Expected", "Predicted", "Result"] as const).map((label, i) => (
                <th
                  key={label}
                  className={`px-4 py-3 text-[11px] font-medium uppercase tracking-[.07em] text-faint whitespace-nowrap ${
                    i === 3 ? "text-right" : "text-left"
                  }`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.field} className="border-t border-line hover:bg-surface-2/70 transition-colors">
                <td className="px-4 py-3 text-left whitespace-nowrap">
                  <code className="font-mono text-[12px] text-text">{row.field}</code>
                </td>
                <td className="px-4 py-3 text-left text-muted tnum whitespace-nowrap">{row.expected}</td>
                <td className="px-4 py-3 text-left text-muted tnum whitespace-nowrap">{row.predicted}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <ResultBadge result={row.result} label={row.label} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[12px] text-faint">
        Leaderboard accuracy is correct ÷ scored across all fields and {nRuns} runs per model.
      </p>
    </div>
  );
}
