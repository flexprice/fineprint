import Link from "next/link";
import { Brand, GitHubIcon, REPO_URL } from "@/components/site-nav";

export function SiteFooter() {
  return (
    <footer className="border-t border-line mt-24 overflow-hidden">
      <div className="shell pt-16 pb-10">
        <div className="flex flex-wrap items-start justify-between gap-x-16 gap-y-8">
          <div>
            <Brand />
            <p className="mt-4 text-sm leading-relaxed text-muted max-w-[44ch]">
              The document-extraction benchmark, by Flexprice. Every new model, scored on real
              contracts turned into structured billing data.
            </p>
          </div>
          {/* Two columns so the nav does not tower over the short left block and
              leave a void above the rule. */}
          <nav className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm text-muted">
            <Link href="/#leaderboard" className="hover:text-text transition-colors">Leaderboard</Link>
            <Link href="/#analytics" className="hover:text-text transition-colors">Charts</Link>
            <Link href="/compare" className="hover:text-text transition-colors">Compare</Link>
            <Link href="/#inside" className="hover:text-text transition-colors">How we measure</Link>
            <Link href="/methodology" className="hover:text-text transition-colors">Methodology</Link>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 hover:text-text transition-colors">
              <GitHubIcon size={15} /> GitHub
            </a>
          </nav>
        </div>

        <p className="mt-10 pt-6 border-t border-line text-[12.5px] text-faint">Private hand-labeled holdout.</p>
      </div>

      {/* Oversized wordmark bleeding off the base of the page. Decorative only.
          "FinePrint" measures 4.948em wide in this face, so font-size = shell width
          / 4.948 makes it span the column exactly. 19vw ≈ that at every breakpoint. */}
      <div aria-hidden className="shell pt-6">
        <div className="wordmark-crop" style={{ fontSize: "clamp(4rem, 19vw, 15.6rem)" }}>
          <span className="wordmark-mark">FinePrint</span>
        </div>
      </div>
    </footer>
  );
}
