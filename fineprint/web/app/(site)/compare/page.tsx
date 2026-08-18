import type { Metadata } from "next";
import { models, newest } from "@/lib/data";
import { CompareView } from "@/components/compare-view";

export const metadata: Metadata = {
  title: "Compare models",
  description:
    "Put document-extraction models head to head: accuracy, hallucination, cost, latency and value on real contracts. Shareable comparison.",
};

const DEFAULT_IDS = () => [newest().id, "gpt-5.5"];

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ models?: string }>;
}) {
  const sp = await searchParams;
  const known = new Set(models.map((m) => m.id));
  let ids = (sp.models ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => known.has(s));
  ids = [...new Set(ids)].slice(0, 4);
  if (ids.length === 0) ids = DEFAULT_IDS();

  return (
    <div className="shell py-12">
      <p className="eyebrow mb-2">Compare</p>
      <h1 className="display text-[clamp(1.8rem,4.5vw,2.6rem)]">Put models head to head.</h1>
      <p className="mt-3 text-[15.5px] leading-relaxed text-muted max-w-[62ch]">
        Pick up to four models and read them side by side. The best value in every row is called out.
        The selection lives in the URL, so any comparison is a link you can share.
      </p>
      <CompareView initial={ids} />
    </div>
  );
}
