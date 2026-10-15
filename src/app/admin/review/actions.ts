"use server";

import { revalidatePath } from "next/cache";
import {
  DIGEST_MIGRATION_HINT,
  DIGEST_POLITICS_HINT,
  DIGEST_PUBLISH_ONE_HINT,
  missingDigestSchema,
  parseDigestDate,
} from "@/lib/digest";
import { createClient } from "@/lib/supabase/server";

export type DigestActionResult =
  | { ok: true; message: string; postId?: number }
  | { ok: false; error: string };

const STORY_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function adminClient(): Promise<
  | { supabase: Awaited<ReturnType<typeof createClient>>; error: null }
  | { supabase: null; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase: null, error: "Sign in as an admin to do that." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    return { supabase: null, error: "You need an admin account to do that." };
  }

  return { supabase, error: null };
}

function actionError(error: { message: string; code?: string }): string {
  if (error.code === "42501" || /not allowed/i.test(error.message)) {
    return "You need an admin account to do that.";
  }
  if (error.message.startsWith("digest:")) {
    return error.message.slice("digest:".length).trim();
  }
  if (/set_digest_story_politics|delete_pending_digest_stories/i.test(error.message)) {
    return DIGEST_POLITICS_HINT;
  }
  if (/is_political/i.test(error.message) && missingDigestSchema(error.message)) {
    return DIGEST_POLITICS_HINT;
  }
  if (/publish_digest_story/i.test(error.message)) return DIGEST_PUBLISH_ONE_HINT;
  if (missingDigestSchema(error.message)) return DIGEST_MIGRATION_HINT;
  return "That could not be saved.";
}

function revalidateDigest(published: boolean) {
  revalidatePath("/admin");
  revalidatePath("/admin/review");
  if (!published) return;
  revalidatePath("/");
  revalidatePath("/new");
  revalidatePath("/sitemap.xml");
}

export async function deleteDigestStory(id: string): Promise<DigestActionResult> {
  if (!STORY_ID.test(id)) return { ok: false, error: "That story could not be found." };

  const { supabase, error } = await adminClient();
  if (error || !supabase) {
    return { ok: false, error: error ?? "You need an admin account to do that." };
  }

  const { data, error: updateError } = await supabase
    .from("digest_stories")
    .update({ status: "deleted" })
    .eq("id", id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (updateError) {
    console.error("Could not hide a digest story:", updateError.message);
    return { ok: false, error: actionError(updateError) };
  }
  if (!data) return { ok: false, error: "That story is no longer waiting." };

  revalidateDigest(false);
  return { ok: true, message: "Deleted. It stays off the site." };
}

export async function publishDigestStory(id: string): Promise<DigestActionResult> {
  if (!STORY_ID.test(id)) return { ok: false, error: "That story could not be found." };

  const { supabase, error } = await adminClient();
  if (error || !supabase) {
    return { ok: false, error: error ?? "You need an admin account to do that." };
  }

  const { data, error: publishError } = await supabase.rpc("publish_digest_story", {
    p_id: id,
  });

  if (publishError) {
    console.error("Could not publish a digest story:", publishError.message);
    return { ok: false, error: actionError(publishError) };
  }

  const postId = Number(data);
  if (!Number.isInteger(postId) || postId <= 0) {
    return { ok: false, error: "That story could not be published." };
  }

  revalidateDigest(true);
  revalidatePath(`/item/${postId}`);
  return { ok: true, message: "Published.", postId };
}

export async function setDigestStoryPolitics(
  id: string,
  isPolitical: boolean
): Promise<DigestActionResult> {
  if (!STORY_ID.test(id) || typeof isPolitical !== "boolean") {
    return { ok: false, error: "That story could not be found." };
  }

  const { supabase, error } = await adminClient();
  if (error || !supabase) {
    return { ok: false, error: error ?? "You need an admin account to do that." };
  }

  const { data, error: saveError } = await supabase.rpc("set_digest_story_politics", {
    p_id: id,
    p_is_political: isPolitical,
  });

  if (saveError) {
    console.error("Could not save a digest politics flag:", saveError.message);
    return { ok: false, error: actionError(saveError) };
  }

  const postId = data == null ? null : Number(data);
  if (postId != null && (!Number.isInteger(postId) || postId <= 0)) {
    return { ok: false, error: "That story could not be saved." };
  }

  revalidateDigest(postId != null);
  if (postId != null) revalidatePath(`/item/${postId}`);
  return {
    ok: true,
    message: postId != null ? "Updated the post." : "Saved.",
    postId: postId ?? undefined,
  };
}

export async function deletePendingDigestStories(date: string): Promise<DigestActionResult> {
  const digestDate = parseDigestDate(date);
  if (!digestDate) return { ok: false, error: "Choose a digest date." };

  const { supabase, error } = await adminClient();
  if (error || !supabase) {
    return { ok: false, error: error ?? "You need an admin account to do that." };
  }

  const { data, error: deleteError } = await supabase.rpc("delete_pending_digest_stories", {
    p_digest_date: digestDate,
  });

  if (deleteError) {
    console.error("Could not hide waiting digest stories:", deleteError.message);
    return { ok: false, error: actionError(deleteError) };
  }

  const count = Number(data);
  if (!Number.isInteger(count) || count < 0) {
    return { ok: false, error: "Those stories could not be deleted." };
  }

  revalidateDigest(false);
  if (count === 0) return { ok: true, message: "Nothing was still waiting." };
  if (count === 1) return { ok: true, message: "Deleted 1 story. It stays off the site." };
  return { ok: true, message: `Deleted ${count} stories. They stay off the site.` };
}
