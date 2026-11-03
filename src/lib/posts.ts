import { createClient } from "@/lib/supabase/server";
import { topStoryCutoff } from "@/lib/top-stories";

export type PostWithStats = {
  id: number;
  title: string;
  url: string | null;
  body: string | null;
  created_at: string;
  author_id: string;
  author_username: string;
  points: number;
  comment_count: number;
  is_political: boolean;
};

/** Stories shown on one homepage page. */
export const PAGE_SIZE = 30;

type TopPostOptions = {
  /** When false, political posts are left out before sorting and limiting. */
  showPolitics?: boolean;
  /** Zero-based row offset. Negative values are treated as zero. */
  offset?: number;
};

export async function getTopPosts(limit = PAGE_SIZE, options?: TopPostOptions): Promise<PostWithStats[]> {
  const supabase = await createClient();
  const offset = Math.max(0, Math.floor(options?.offset ?? 0));
  const cutoff = topStoryCutoff();
  const hidePolitics = options?.showPolitics === false;

  let countQuery = supabase.from("posts_with_stats").select("id", { count: "exact", head: true });
  if (hidePolitics) countQuery = countQuery.eq("is_political", false);
  const { count, error: countError } = await countQuery.gt("created_at", cutoff);
  if (countError) {
    console.error("Error fetching top posts:", countError.message);
    return [];
  }

  const freshCount = count ?? 0;

  async function page(fresh: boolean, start: number, size: number): Promise<PostWithStats[] | null> {
    if (size <= 0) return [];
    let query = supabase.from("posts_with_stats").select("*");
    if (hidePolitics) query = query.eq("is_political", false);
    query = fresh ? query.gt("created_at", cutoff) : query.lte("created_at", cutoff);
    const { data, error } = await query
      .order("points", { ascending: false })
      .order("created_at", { ascending: false })
      // range() is inclusive, so a full page of 30 ends at start + size - 1.
      .range(start, start + size - 1);
    if (error) {
      console.error("Error fetching top posts:", error.message);
      return null;
    }
    return data ?? [];
  }

  // Stories from the last 72 hours fill the top of the ranking. Older stories
  // keep their points and follow that whole group, including on later pages.
  if (offset >= freshCount) {
    return (await page(false, offset - freshCount, limit)) ?? [];
  }
  if (offset + limit <= freshCount) {
    return (await page(true, offset, limit)) ?? [];
  }

  const freshRows = await page(true, offset, freshCount - offset);
  if (!freshRows) return [];
  const oldRows = await page(false, 0, limit - freshRows.length);
  if (!oldRows) return freshRows;
  return [...freshRows, ...oldRows];
}

export async function getNewPosts(limit = 30): Promise<PostWithStats[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts_with_stats")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching new posts:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getSitemapPosts(): Promise<Pick<PostWithStats, "id" | "created_at">[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return [];
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("posts_with_stats")
      .select("id, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      console.error("Error fetching sitemap posts:", error.message);
      return [];
    }

    return data ?? [];
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load sitemap posts.";
    console.error("Error fetching sitemap posts:", message);
    return [];
  }
}

export async function getPostById(id: number): Promise<PostWithStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts_with_stats")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching post:", error.message);
    return null;
  }
  return data;
}
