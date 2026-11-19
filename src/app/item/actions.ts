"use server";

import { revalidatePublicStories, revalidateUserProfile } from "@/lib/revalidate-public";
import { createClient } from "@/lib/supabase/server";

async function authorUsername(
  supabase: Awaited<ReturnType<typeof createClient>>,
  authorId: string
): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("username").eq("id", authorId).maybeSingle();
  return typeof data?.username === "string" ? data.username : null;
}

/** After the author or an admin edits a story, refresh the public pages. */
export async function revalidatePublishedPost(postId: number): Promise<void> {
  if (!Number.isInteger(postId) || postId <= 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: post } = await supabase.from("posts").select("author_id").eq("id", postId).maybeSingle();
  if (!post?.author_id) return;

  const { data: viewer } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!viewer?.is_admin && post.author_id !== user.id) return;

  revalidatePublicStories(postId);
  revalidateUserProfile((await authorUsername(supabase, post.author_id)) ?? "");
}

/** Delete a story the caller is allowed to remove, then refresh the public pages. */
export async function deletePublishedPost(
  postId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Number.isInteger(postId) || postId <= 0) {
    return { ok: false, error: "That story could not be found." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Log in to delete that story." };

  const { data: post } = await supabase.from("posts").select("author_id").eq("id", postId).maybeSingle();
  const username = post?.author_id ? await authorUsername(supabase, post.author_id) : null;

  const { data: deleted, error } = await supabase.from("posts").delete().eq("id", postId).select("id");
  if (error) return { ok: false, error: error.message };
  if (!deleted?.length) return { ok: false, error: "You cannot delete that story." };

  revalidatePublicStories(postId);
  if (username) revalidateUserProfile(username);
  return { ok: true };
}
