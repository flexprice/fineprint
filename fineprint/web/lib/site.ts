// The canonical origin, in one place. Vercel injects NEXT_PUBLIC_SITE_URL per
// environment; the fallback keeps local builds and previews coherent.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://fineprint.bench").replace(/\/$/, "");

export const SITE_NAME = "FinePrint";
export const SITE_TAGLINE = "the document-extraction benchmark";
