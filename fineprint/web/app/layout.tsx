import type { Metadata } from "next";
import { Rubik, Geist_Mono } from "next/font/google";
import "./globals.css";

// Rubik — thicker, subtly rounded (softer) edges; mono kept for data/labels.
const sans = Rubik({ variable: "--font-geist-sans", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const TITLE = "FinePrint — the document-extraction benchmark";
const DESCRIPTION =
  "Can it actually read the contract? Every new model, scored on real-world documents turned into structured data. Private test set. Updated the day a model ships.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://fineprint.bench"),
  title: { default: TITLE, template: "%s — FinePrint" },
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
    <html lang="en" className={`${sans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
