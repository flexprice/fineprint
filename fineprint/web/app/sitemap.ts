import type { MetadataRoute } from "next";
import { models } from "@/lib/data";
import { SITE_URL } from "@/lib/site";

// Every model gets a statically-generated page (generateStaticParams in
// models/[id]), and there are 50+ of them — without a sitemap they are reachable
// only by crawling the leaderboard table, which is client-sorted.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/compare`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/reviews`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/methodology`, changeFrequency: "monthly", priority: 0.6 },
  ];

  const modelPages: MetadataRoute.Sitemap = models.map((m) => ({
    url: `${SITE_URL}/models/${m.id}`,
    changeFrequency: "weekly" as const,
    // The newest entries are the ones worth recrawling first.
    priority: m.new ? 0.7 : 0.5,
  }));

  return [...pages, ...modelPages].map((p) => ({ ...p, lastModified: now }));
}
