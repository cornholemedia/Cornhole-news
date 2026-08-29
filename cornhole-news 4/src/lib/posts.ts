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
