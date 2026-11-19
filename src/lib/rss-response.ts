import "server-only";
import { getPublishedFeedPosts } from "@/lib/feed-posts";
import { RSS_REVALIDATE_SECONDS, buildRssFeed } from "@/lib/rss";
import { DEFAULT_DESCRIPTION, SITE_NAME, getSiteUrl } from "@/lib/site";

export async function rssFeedResponse(): Promise<Response> {
  const xml = buildRssFeed({
    siteUrl: getSiteUrl(),
    siteName: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    items: await getPublishedFeedPosts(),
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": `public, s-maxage=${RSS_REVALIDATE_SECONDS}, stale-while-revalidate=${RSS_REVALIDATE_SECONDS * 2}`,
    },
  });
}
