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
  const url = `url(/icons/${MONO[b] ?? "openai"}.svg)`;
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
