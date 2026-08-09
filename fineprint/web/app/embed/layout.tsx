import type { Metadata } from "next";

// Bare layout for the iframe widget — no site nav/footer (this route sits outside the
// (site) group), no indexing. Theme still honours ?theme=light|dark via the root script.
export const metadata: Metadata = {
  title: "FinePrint leaderboard",
  robots: { index: false, follow: false },
};

export default function EmbedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="p-3 sm:p-4">{children}</div>;
}
