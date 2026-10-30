// Lab marks. Most labs render as their authentic full-color logo (public/icons/color/); labs with a
// single-color mark (OpenAI, xAI, IBM, ...) render as a theme-adaptive currentColor silhouette via
// CSS mask (dark on light, light on dark). brand id (registry) -> asset; no extension means .svg.
const COLOR: Record<string, string> = {
  anthropic: "anthropic", claude: "anthropic",
  google: "google", gemini: "google",
  meta: "meta", "meta-llama": "meta",
  mistral: "mistral", mistralai: "mistral",
  deepseek: "deepseek", qwen: "qwen", tencent: "tencent.png",
  cohere: "cohere", perplexity: "perplexity",
  // moonshot / kimi, amazon and apodex: theme-split assets in THEMED below
  zhipu: "zhipu", "z-ai": "zhipu", glm: "zhipu",
  minimax: "minimax", nvidia: "nvidia", nemotron: "nvidia",
  bytedance: "bytedance", "bytedance-seed": "bytedance", baidu: "baidu", microsoft: "microsoft",
  inclusionai: "ling", meituan: "longcat", stepfun: "stepfun",
  "aion-labs": "aionlabs", "arcee-ai": "arcee", fireworks: "fireworks", morph: "morph",
  poolside: "poolside", sakana: "sakana", upstage: "upstage", venice: "venice", mancer: "mancer",
  "anthracite-org": "anthracite.webp", thinkingmachines: "thinkingmachines.png",
};
const MONO: Record<string, string> = {
  openai: "openai", xai: "xai", "x-ai": "xai", grok: "xai", xiaomi: "xiaomi", kwaipilot: "kwaipilot",
  ibm: "ibm", "ibm-granite": "ibm", "dots-studio": "dots", inception: "inception.png",
  "inference-net": "inference", liquid: "liquid", "nex-agi": "nex", nousresearch: "nousresearch",
  perceptron: "perceptron", "prism-ml": "prismml.webp", rekaai: "reka", relace: "relace",
  writer: "writer.png", openrouter: "openrouter", typesafe: "typesafe",
};
// Marks drawn for one background (Kimi's solid K, Amazon's dark wordmark, Apodex's tile), so each
// theme gets its own asset: [light, dark].
const THEMED: Record<string, [string, string]> = {
  moonshot: ["moonshot", "moonshot-dark"], moonshotai: ["moonshot", "moonshot-dark"],
  kimi: ["moonshot", "moonshot-dark"], apodex: ["apodex.webp", "apodex-dark.webp"],
  amazon: ["amazon", "amazon-dark"], aws: ["amazon", "amazon-dark"], nova: ["amazon", "amazon-dark"],
};
const asset = (name: string) => (name.includes(".") ? name : `${name}.svg`);

export function ProviderIcon({ brand, size = 17, className = "" }: { brand: string; size?: number; className?: string }) {
  const b = brand?.toLowerCase().trim().replace(/^~/, "");
  if (b === "space-bunny") {
    // Space Bunny is an anonymous OpenRouter model, so use its own model mark without
    // assigning it to a real provider.
    return (
      <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-full ${className}`}
        style={{ width: size, height: size, background: "#7558d9", overflow: "hidden" }}>
        <svg width={size * 0.78} height={size * 0.78} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7.1 11.1C5.7 6.7 6.1 2.4 8.3 2.4c2.1 0 2.7 4.1 2.9 7.1m5.7 1.6c1.4-4.4 1-8.7-1.2-8.7-2.1 0-2.7 4.1-2.9 7.1" stroke="white" strokeWidth="2.1" strokeLinecap="round" />
          <path d="M4.2 14.5c0-4 3.3-6.4 7.8-6.4s7.8 2.4 7.8 6.4-3.3 7-7.8 7-7.8-3-7.8-7Z" fill="white" />
          <circle cx="9.2" cy="14.2" r=".9" fill="#49318d" /><circle cx="14.8" cy="14.2" r=".9" fill="#49318d" />
          <path d="M11 16.2h2l-1 1.2-1-1.2Z" fill="#ef8b9f" />
        </svg>
      </span>
    );
  }
  const themed = THEMED[b];
  if (themed) {
    return (
      <span className={`inline-grid shrink-0 ${className}`} style={{ width: size, height: size }} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/icons/color/${asset(themed[0])}`} alt="" width={size} height={size}
          className="fp-logo-light col-start-1 row-start-1" style={{ objectFit: "contain" }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/icons/color/${asset(themed[1])}`} alt="" width={size} height={size}
          className="fp-logo-dark col-start-1 row-start-1" style={{ objectFit: "contain" }} />
      </span>
    );
  }
  const color = COLOR[b];
  if (color) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img src={`/icons/color/${asset(color)}`} alt="" aria-hidden width={size} height={size}
        className={`inline-block shrink-0 ${className}`} style={{ objectFit: "contain" }} />
    );
  }
  const mono = MONO[b];
  if (mono) {
    const url = `url(/icons/${asset(mono)})`;
    return (
      <span
        aria-hidden
        className={`inline-block shrink-0 ${className}`}
        style={{
          width: size, height: size, color: "var(--text)", background: "currentColor",
          maskImage: url, WebkitMaskImage: url,
          maskSize: "contain", WebkitMaskSize: "contain",
          maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat",
          maskPosition: "center", WebkitMaskPosition: "center",
        }}
      />
    );
  }
  // Unmapped lab (a stealth/cloaked model, or a new lab not yet added to COLOR/MONO above) — a
  // neutral initial badge, never a real competitor's logo. Misattributing an unknown model to
  // e.g. OpenAI's mark on a public leaderboard is actively misleading, not a harmless fallback.
  const initial = (brand || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden
      className={`inline-flex items-center justify-center shrink-0 rounded-full ${className}`}
      style={{
        width: size, height: size, background: "var(--surface-2)", color: "var(--faint)",
        fontSize: size * 0.55, fontWeight: 700, lineHeight: 1, fontFamily: "var(--font-sans)",
      }}
    >
      {initial}
    </span>
  );
}
