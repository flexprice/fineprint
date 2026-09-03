import type { Metadata } from "next";
import { Geist, Homemade_Apple } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Geist carries everything. There is deliberately no mono face loaded — labels and
// data that used to be monospaced now run in Geist with tabular figures.
const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
// Homemade Apple — the FinePrint wordmark only, never body copy.
const wordmark = Homemade_Apple({ variable: "--font-wordmark", subsets: ["latin"], weight: "400" });

const TITLE = "FinePrint: the document-extraction benchmark";
const DESCRIPTION =
  "Can it actually read the contract? Every new model, scored on real-world documents turned into structured data. Private test set. Updated the day a model ships.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://fineprint.bench"),
  title: { default: TITLE, template: "%s · FinePrint" },
  description: DESCRIPTION,
  applicationName: "FinePrint",
  openGraph: { type: "website", siteName: "FinePrint", title: TITLE, description: DESCRIPTION, locale: "en_US" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true },
};

// Apply a saved theme before paint (system default handled by prefers-color-scheme in CSS).
const themeScript = `(function(){try{var p=new URLSearchParams(location.search).get('theme');var t=(p==='light'||p==='dark')?p:localStorage.getItem('fp-theme');if(t)document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${wordmark.variable}`} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
