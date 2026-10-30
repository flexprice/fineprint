"use client";

import { ProviderIcon } from "@/components/provider-icon";
import { marketData } from "@/lib/market-data";

// Major providers represented across the model catalog.
const LABS = [
  "openai", "google", "anthropic", "xai", "meta", "mistral",
  "deepseek", "qwen", "moonshot", "zhipu", "amazon", "cohere",
  "perplexity", "minimax", "nvidia",
] as const;

// OpenRouter author slug -> lab, where the slug differs from the lab id or one lab publishes
// under two slugs.
const LAB_OF: Record<string, string> = {
  "x-ai": "xai", mistralai: "mistral", moonshotai: "moonshot", "z-ai": "zhipu",
  "meta-llama": "meta", "bytedance-seed": "bytedance",
};

// Names for labs whose OpenRouter "Lab: Model" prefix is missing or not the name we show.
const LABELS: Record<string, string> = {
  openai: "OpenAI", google: "Google", anthropic: "Anthropic", xai: "xAI",
  meta: "Meta", mistral: "Mistral", deepseek: "DeepSeek", qwen: "Qwen",
  moonshot: "Kimi", zhipu: "Zhipu", amazon: "Amazon", cohere: "Cohere",
  perplexity: "Perplexity", minimax: "MiniMax", nvidia: "NVIDIA",
  bytedance: "ByteDance", liquid: "Liquid AI", nousresearch: "Nous Research", sakana: "Sakana AI",
  rekaai: "Reka",
};

// Kept off the strip: anonymous models, hobbyist and community fine-tunes of other labs' models,
// and publishers we can't identify. They still appear in the rankings.
const OFF_STRIP = new Set([
  "stealth", "sao10k", "thedrummer", "undi95", "gryphe", "anthracite-org", "mancer", "unbiased",
]);

const labOf = (creator: string) => LAB_OF[creator] ?? creator;

function labName(lab: string) {
  const named = marketData.rows.find((m) => labOf(m.creator) === lab && m.label.includes(":"));
  return LABELS[lab] ?? named?.label.split(":")[0].trim() ?? lab;
}

export function LabMarquee() {
  // Ranked rows, not the picker catalog: the catalog also carries OpenRouter's moving
  // "~lab/...-latest" aliases and routers, which put a lab on the strip twice and routers on it
  // as labs.
  const sourceLabs = [...new Set(marketData.rows.map((m) => labOf(m.creator)))].filter((lab) => !OFF_STRIP.has(lab));
  const labs = sourceLabs.length ? sourceLabs : [...LABS];
  const row = [...labs, ...labs];
  return (
    <div className="fp-marquee" aria-label="Model providers">
      {/* 1.6s per lab keeps the scroll speed the same however many labs the data lists. */}
      <div className="fp-marquee-track" style={{ ["--fp-marquee-duration" as string]: `${labs.length * 1.6}s` }}>
        {row.map((brand, i) => (
          <span key={`${brand}-${i}`} className="fp-marquee-item">
            <ProviderIcon brand={brand} size={30} />
            <span className="text-[14.5px] text-muted font-medium tracking-[-.01em]">
              {labName(brand)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
