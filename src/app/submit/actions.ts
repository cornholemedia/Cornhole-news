"use server";

import { fieldValue } from "@/lib/form-fields";
import { friendlyWriteError, cleanPostBody, cleanPostTitle, safePostUrl } from "@/lib/post-fields";
import { cleanStoryState, missingPostStateColumn, STORY_STATE_MIGRATION_HINT } from "@/lib/story-state";
import { recordIpAttempt } from "@/lib/rate-limit";
import { requestClientIp, requestIpHash } from "@/lib/request-ip";
import { revalidatePublicStories, revalidateUserProfile } from "@/lib/revalidate-public";
import { createClient } from "@/lib/supabase/server";
import { TURNSTILE_FIELD, verifyTurnstileToken } from "@/lib/turnstile";

export async function submitPost(
  formData: FormData
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const title = cleanPostTitle(fieldValue(formData.get("title")));
  if (!title) return { ok: false, error: "Title is required and must be 300 characters or fewer." };

  const rawUrl = fieldValue(formData.get("url")).trim();
  let url: string | null = null;
  if (rawUrl) {
    url = safePostUrl(rawUrl);
    if (!url) return { ok: false, error: "Enter a valid http or https link." };
  }

  const body = cleanPostBody(fieldValue(formData.get("body")));
  if (body === null) return { ok: false, error: "The text must be 10,000 characters or fewer." };

  const state = cleanStoryState(fieldValue(formData.get("state")));
  if (!state.ok) return state;

  const human = await verifyTurnstileToken(
    fieldValue(formData.get(TURNSTILE_FIELD)),
    await requestClientIp()
  );
  if (!human.ok) return human;

  const limited = await recordIpAttempt("post", await requestIpHash());
  if (!limited.ok) return limited;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Log in to submit a story." };

  const row = {
    title,
    url,
    body: body || null,
    is_political: formData.get("isPolitical") === "on",
    author_id: user.id,
  };

  let { data, error } = await supabase
    .from("posts")
    .insert({ ...row, state: state.value })
    .select("id")
    .single();

  if (error && state.value === null && missingPostStateColumn(error.message)) {
    const retry = await supabase.from("posts").insert(row).select("id").single();
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) {
    if (error && missingPostStateColumn(error.message)) {
      return { ok: false, error: STORY_STATE_MIGRATION_HINT };
    }
    return { ok: false, error: friendlyWriteError(error?.message ?? "") };
  }

  revalidatePublicStories(data.id);
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  if (typeof profile?.username === "string") revalidateUserProfile(profile.username);

  return { ok: true, id: data.id };
}
