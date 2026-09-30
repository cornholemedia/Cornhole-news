import type { MetadataRoute } from "next";
import { getSitemapPosts } from "@/lib/posts";
import { getSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

const STATIC_PATHS = [
  "/",
  "/new",
  "/submit",
  "/about",
  "/jobs",
  "/advertise",
  "/privacy",
  "/terms",
  "/contact",
  "/login",
  "/signup",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const posts = await getSitemapPosts();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: path === "/" ? siteUrl : `${siteUrl}${path}`,
    changeFrequency: path === "/" || path === "/new" ? "hourly" : "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));

  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${siteUrl}/item/${post.id}`,
    lastModified: post.created_at,
    changeFrequency: "daily",
    priority: 0.6,
  }));

  return [...staticEntries, ...postEntries];
}
