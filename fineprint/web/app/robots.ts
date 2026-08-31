import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // /embed is the iframe widget — it duplicates the leaderboard with no
      // chrome, so keeping it out of the index avoids competing with the page
      // it is embedded from.
      { userAgent: "*", allow: "/", disallow: ["/embed"] },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
