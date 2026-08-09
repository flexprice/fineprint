import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

const LINKS: [string, string][] = [
  ["Leaderboard", "/#leaderboard"],
  ["Charts", "/#analytics"],
  ["Compare", "/compare"],
  ["What's inside", "/#inside"],
  ["Methodology", "/methodology"],
];

// FinePrint is the product; Flexprice is the maker — real Flexprice wordmark, theme-aware.
export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="font-semibold tracking-tight text-[15px]">FinePrint</span>
      <span className="text-faint text-[12px]">by</span>
      {/* eslint-disable @next/next/no-img-element */}
      <img src="/icons/flexprice-wordmark-dark.svg" alt="Flexprice" className="fp-logo-light" style={{ height: 16 }} />
      <img src="/icons/flexprice-wordmark-light.svg" alt="Flexprice" className="fp-logo-dark" style={{ height: 16 }} />
      {/* eslint-enable @next/next/no-img-element */}
    </Link>
  );
}

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md border-b border-line" style={{ background: "color-mix(in srgb, var(--bg) 78%, transparent)" }}>
      <div className="mx-auto max-w-6xl px-5 flex items-center gap-5 py-3.5">
        <Brand />
        <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-muted">
          {LINKS.map(([label, href]) => (
            <Link key={label} href={href} className="hover:text-text transition-colors">{label}</Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2.5">
          <ThemeToggle />
          <Link href="/#leaderboard" className="btn btn-primary">See the leaderboard</Link>
        </div>
      </div>
    </header>
  );
}
