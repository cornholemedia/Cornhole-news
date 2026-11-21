import "server-only";
import { RSS_FEED_LIMIT, toFeedItem, type RssItem } from "@/lib/rss";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Latest public stories for the RSS feed.
 *
 * Posts are the published site. A digest story stays out of `posts` until an
 * admin publishes it, and a deleted digest story has no post. Pending and
 * rejected job listings live in `job_postings`, not here. This read uses the
 * public anon key and the same `posts_with_stats` view as the New page. It
 * does not use the service role key.
 */
export async function getPublishedFeedPosts(limit = RSS_FEED_LIMIT): Promise<RssItem[]> {
  const supabase = createPublicClient();
  if (!supabase) return [];

  const size = Math.min(RSS_FEED_LIMIT, Math.max(1, Math.floor(limit) || RSS_FEED_LIMIT));
  const { data, error } = await supabase
    .from("posts_with_stats")
    .select("id, title, body, created_at, released_at")
    .order("released_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(size);

  if (error) {
    console.error("Error fetching RSS posts:", error.message);
    return [];
  }

  const items: RssItem[] = [];
  for (const row of data ?? []) {
    const item = toFeedItem({
      ...row,
      created_at: row.released_at || row.created_at,
    });
    if (item) items.push(item);
  }
  return items;
}

