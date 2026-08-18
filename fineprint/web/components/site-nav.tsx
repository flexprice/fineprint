import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export const REPO_URL = "https://github.com/flexprice/fineprint";

export function GitHubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" aria-hidden focusable="false">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

const LINKS: [string, string][] = [
  ["Leaderboard", "/#leaderboard"],
  ["Charts", "/#analytics"],
  ["Compare", "/compare"],
  ["Methodology", "/methodology"],
];

// FinePrint is the product; Flexprice is the maker. Only one of the two wordmark
// images is visible at a time (CSS theme swap), so the hidden one must not also
// announce itself to a screen reader.
export function Brand({ size = 21 }: { size?: number }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 shrink-0">
      <span className="wordmark" style={{ fontSize: size }}>FinePrint</span>
      <span className="text-faint text-[12px]">by</span>
      {/* eslint-disable @next/next/no-img-element */}
      <img src="/icons/flexprice-wordmark-dark.svg" alt="Flexprice" className="fp-logo-light" style={{ height: 16 }} />
      <img src="/icons/flexprice-wordmark-light.svg" alt="" aria-hidden className="fp-logo-dark" style={{ height: 16 }} />
      {/* eslint-enable @next/next/no-img-element */}
    </Link>
  );
}

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md border-b border-line" style={{ background: "color-mix(in srgb, var(--bg) 78%, transparent)" }}>
      {/* Three tracks so the nav is optically centred in the page, not just after the logo. */}
      <div className="shell grid grid-cols-[auto_1fr_auto] items-center gap-5 py-5">
        <Brand />
        <nav className="hidden md:flex items-center justify-center gap-7 text-sm font-medium text-muted">
          {LINKS.map(([label, href]) => (
            <Link key={label} href={href} className="hover:text-text transition-colors whitespace-nowrap">{label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-2.5 justify-end">
          <ThemeToggle />
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            <GitHubIcon /> GitHub
          </a>
        </div>
      </div>
    </header>
  );
}
