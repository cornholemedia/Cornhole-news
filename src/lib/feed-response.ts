import "server-only";
import { NextResponse } from "next/server";
import { getPublishedFeedStories } from "@/lib/feed";
import { buildRssFeed, FEED_REVALIDATE_SECONDS } from "@/lib/rss";
import { DEFAULT_DESCRIPTION, SITE_NAME, getSiteUrl } from "@/lib/site";

export async function rssFeedResponse(selfPath: string): Promise<NextResponse> {
  const stories = await getPublishedFeedStories();
  const xml = buildRssFeed({
    siteUrl: getSiteUrl(),
    siteName: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    selfPath,
    stories,
  });

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": `public, max-age=${FEED_REVALIDATE_SECONDS}, s-maxage=${FEED_REVALIDATE_SECONDS}, stale-while-revalidate=${FEED_REVALIDATE_SECONDS * 2}`,
    },
  });
}
