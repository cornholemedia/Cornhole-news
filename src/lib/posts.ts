import { cache } from "react";
import { missingReleasedAtColumn } from "@/lib/drip-schedule";
import { createPublicClient } from "@/lib/supabase/public";
import { topStoryCutoff } from "@/lib/top-stories";

export type PostWithStats = {
  id: number;
  title: string;
  url: string | null;
  body: string | null;
  created_at: string;
  /** When the story became public. Falls back to created_at for older rows. */
  released_at?: string;
  author_id: string;
  author_username: string;
  points: number;
  comment_count: number;
  is_political: boolean;
  /** Uppercase Midwest code, or null when the story has no single state. */
  state: string | null;
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
  const supabase = createPublicClient();
  if (!supabase) return [];
  const db = supabase;
  const offset = Math.max(0, Math.floor(options?.offset ?? 0));
  const cutoff = topStoryCutoff();
  const hidePolitics = options?.showPolitics === false;

  let countQuery = db.from("posts_with_stats").select("id", { count: "exact", head: true });
  if (hidePolitics) countQuery = countQuery.eq("is_political", false);
  const { count, error: countError } = await countQuery.gt("created_at", cutoff);
  if (countError) {
    console.error("Error fetching top posts:", countError.message);
    return [];
  }

  const freshCount = count ?? 0;

  async function page(fresh: boolean, start: number, size: number): Promise<PostWithStats[] | null> {
    if (size <= 0) return [];
    const load = (useReleasedAt: boolean) => {
      let query = db.from("posts_with_stats").select("*");
      if (hidePolitics) query = query.eq("is_political", false);
      query = fresh ? query.gt("created_at", cutoff) : query.lte("created_at", cutoff);
      return (
        query
          .order("points", { ascending: false })
          .order(useReleasedAt ? "released_at" : "created_at", { ascending: false })
          .order("id", { ascending: false })
          // range() is inclusive, so a full page of 30 ends at start + size - 1.
          .range(start, start + size - 1)
      );
    };
    let { data, error } = await load(true);
    // The drip column is added by a migration the owner runs separately.
    // Until then, rank by created_at, which matches released_at for every live post.
    if (error && missingReleasedAtColumn(error.message)) {
      ({ data, error } = await load(false));
    }
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
  const supabase = createPublicClient();
  if (!supabase) return [];
  const load = (useReleasedAt: boolean) =>
    supabase
      .from("posts_with_stats")
      .select("*")
      .order(useReleasedAt ? "released_at" : "created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);

  let { data, error } = await load(true);
  if (error && missingReleasedAtColumn(error.message)) {
    ({ data, error } = await load(false));
  }
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
    const supabase = createPublicClient();
    if (!supabase) return [];
    const withRelease = await supabase
      .from("posts_with_stats")
      .select("id, created_at, released_at")
      .order("released_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1000);

    if (!withRelease.error) {
      return (withRelease.data ?? []).map((row) => ({
        id: row.id,
        created_at: row.released_at || row.created_at,
      }));
    }

    if (!missingReleasedAtColumn(withRelease.error.message)) {
      console.error("Error fetching sitemap posts:", withRelease.error.message);
      return [];
    }

    const plain = await supabase
      .from("posts_with_stats")
      .select("id, created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1000);

    if (plain.error) {
      console.error("Error fetching sitemap posts:", plain.error.message);
      return [];
    }

    return (plain.data ?? []).map((row) => ({
      id: row.id,
      created_at: row.created_at,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load sitemap posts.";
    console.error("Error fetching sitemap posts:", message);
    return [];
  }
}

export const getPostById = cache(async function getPostById(id: number): Promise<PostWithStats | null> {
  const supabase = createPublicClient();
  if (!supabase) return null;
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
});
