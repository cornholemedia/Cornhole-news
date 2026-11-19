import "server-only";
import { FEED_STORY_LIMIT, type RssStory } from "@/lib/rss";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Latest stories for the public feed.
 *
 * A story is published when it has a row in posts. The homepage and the New
 * page read those rows through posts_with_stats. Digest items stay in
 * digest_stories until an admin publishes them, and that step is what inserts
 * the posts row. Pending and deleted digest rows have no posts row, and job
 * postings (pending, approved, or rejected) are a different table. This query
 * never reads those.
 */
export async function getPublishedFeedStories(): Promise<RssStory[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = createPublicClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("posts_with_stats")
      .select("id, title, body, created_at")
      .order("created_at", { ascending: false })
      .limit(FEED_STORY_LIMIT);

    if (error) {
      console.error("Error fetching feed stories:", error.message);
      return [];
    }

    return (data ?? []).flatMap((row) => {
      const id = typeof row.id === "number" ? row.id : Number(row.id);
      if (!Number.isInteger(id) || id <= 0) return [];
      if (typeof row.title !== "string" || typeof row.created_at !== "string") return [];
      return [
        {
          id,
          title: row.title,
          body: typeof row.body === "string" ? row.body : null,
          created_at: row.created_at,
        },
      ];
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load feed stories.";
    console.error("Error fetching feed stories:", message);
    return [];
  }
}
