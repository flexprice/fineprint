import Link from "next/link";
import { data } from "@/lib/data";
import { Brand } from "@/components/site-nav";

export function SiteFooter() {
  return (
    <footer className="border-t border-line mt-24">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Brand />
            <p className="mt-3 text-sm text-muted max-w-[46ch]">
              The document-extraction benchmark, by Flexprice. Every new model, scored on real
              contracts turned into structured billing data.
            </p>
          </div>
          <nav className="flex gap-6 text-sm text-muted">
            <Link href="/#leaderboard" className="hover:text-text">Leaderboard</Link>
            <Link href="/methodology" className="hover:text-text">Methodology</Link>
            <Link href="/#inside" className="hover:text-text">What&rsquo;s inside</Link>
          </nav>
        </div>
        <p className="mt-10 font-mono text-[11.5px] text-faint">
          {data.total_judgments.toLocaleString()} field judgments · {data.n_runs} runs per contract ·
          private hand-labeled holdout · pricing via OpenRouter
        </p>
      </div>
    </footer>
  );
}
