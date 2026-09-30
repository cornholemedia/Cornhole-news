import { createClient } from "@/lib/supabase/server";

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
};

export async function getTopPosts(limit = 30): Promise<PostWithStats[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts_with_stats")
    .select("*")
    .order("points", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching top posts:", error.message);
    return [];
  }
  return data ?? [];
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
