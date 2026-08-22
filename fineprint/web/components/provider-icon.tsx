// Lab marks. Eight labs render as their authentic full-color logo (public/icons/color/*.svg);
// OpenAI and xAI are genuinely monochrome brands, so they render as a theme-adaptive currentColor
// silhouette via CSS mask (dark on light, light on dark). brand id (registry) -> asset.
const COLOR: Record<string, string> = {
  anthropic: "anthropic", claude: "anthropic",
  google: "google", gemini: "google",
  meta: "meta", "meta-llama": "meta",
  mistral: "mistral", mistralai: "mistral",
  deepseek: "deepseek", qwen: "qwen",
  cohere: "cohere", perplexity: "perplexity",
  moonshot: "moonshot", moonshotai: "moonshot", kimi: "moonshot",
  zhipu: "zhipu", "z-ai": "zhipu", glm: "zhipu",
  amazon: "amazon", aws: "amazon", nova: "amazon",
  minimax: "minimax", nvidia: "nvidia", nemotron: "nvidia",
};
const MONO: Record<string, string> = {
  openai: "openai", xai: "xai", "x-ai": "xai", grok: "xai",
};

export function ProviderIcon({ brand, size = 17, className = "" }: { brand: string; size?: number; className?: string }) {
  const b = brand?.toLowerCase();
  const color = COLOR[b];
  if (color) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img src={`/icons/color/${color}.svg`} alt="" aria-hidden width={size} height={size}
        className={`inline-block shrink-0 ${className}`} style={{ objectFit: "contain" }} />
    );
  }
  const mono = MONO[b];
  if (mono) {
    const url = `url(/icons/${mono}.svg)`;
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
