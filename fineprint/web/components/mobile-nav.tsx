"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// The desktop nav is `hidden lg:flex`, so below 1024px the header carried no links
// at all — Reviews, Compare and Methodology were reachable only from the footer.
// This is the same link set behind a disclosure button.
export function MobileNav({ links }: { links: [string, string][] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // A hash link (/#leaderboard) to the page you are already on fires no
  // navigation event, so close on click as well as on route change.
  useEffect(() => setOpen(false), [pathname]);

  // Escape closes, and the page behind must not scroll under the sheet.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="fp-mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        className="btn btn-ghost btn-icon"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" aria-hidden>
          {open ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
        </svg>
      </button>

      {open && (
        <>
          {/* Sits below the panel but above the page; tapping it dismisses. */}
          <div className="fixed inset-0 top-[var(--nav-h)] z-30 bg-black/25" onClick={() => setOpen(false)} aria-hidden />
          <div
            id="fp-mobile-nav"
            className="fixed inset-x-0 top-[var(--nav-h)] z-40 border-b border-line bg-bg shadow-[var(--shadow-card)]"
          >
            <nav className="shell flex flex-col py-2">
              {links.map(([label, href]) => (
                <Link
                  key={label}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="border-b border-line py-3.5 text-[15px] font-medium text-muted transition-colors last:border-0 hover:text-text"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
