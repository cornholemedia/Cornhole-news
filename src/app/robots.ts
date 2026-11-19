import type { MetadataRoute } from "next";
import { AGGRESSIVE_AI_CRAWLERS } from "@/lib/crawler-blocks";
import { getSiteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api/",
          "/auth/",
          "/reset-password",
          "/forgot-password",
          "/newsletter/",
          "/p/",
          "/no-politics",
        ],
      },
      ...AGGRESSIVE_AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        disallow: "/",
      })),
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
