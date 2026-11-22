"use server";

import { fieldValue } from "@/lib/form-fields";
import { friendlyWriteError, cleanPostBody, cleanPostTitle, safePostUrl } from "@/lib/post-fields";
import { cleanStoryState, missingPostStateColumn, STORY_STATE_MIGRATION_HINT } from "@/lib/story-state";
import { recordIpAttempt } from "@/lib/rate-limit";
import { requestClientIp, requestIpHash } from "@/lib/request-ip";
import { revalidatePublicStories, revalidateUserProfile } from "@/lib/revalidate-public";
import { createClient } from "@/lib/supabase/server";
import { TURNSTILE_FIELD, verifyTurnstileToken } from "@/lib/turnstile";

const WRITE_TIMEOUT_MS = 8_000;
const SUBMIT_FAILED = "We could not submit that story. Please try again.";
const SUBMIT_TIMED_OUT = "The submission took too long. Please try again.";

type SubmitResult = { ok: true; id: number } | { ok: false; error: string };

function timedOut(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error && typeof error.name === "string" ? error.name : "";
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  return name === "AbortError" || name === "TimeoutError" || /aborted|timeout/i.test(message);
}

export async function submitPost(formData: FormData): Promise<SubmitResult> {
  try {
    return await saveSubmittedPost(formData);
  } catch (error) {
    console.error("Could not submit a story:", error instanceof Error ? error.message : "unknown error");
    return { ok: false, error: timedOut(error) ? SUBMIT_TIMED_OUT : SUBMIT_FAILED };
  }
}

async function saveSubmittedPost(formData: FormData): Promise<SubmitResult> {
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
    .abortSignal(AbortSignal.timeout(WRITE_TIMEOUT_MS))
    .single();

  if (error && state.value === null && missingPostStateColumn(error.message)) {
    const retry = await supabase
      .from("posts")
      .insert(row)
      .select("id")
      .abortSignal(AbortSignal.timeout(WRITE_TIMEOUT_MS))
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) {
    if (error && timedOut(error)) return { ok: false, error: SUBMIT_TIMED_OUT };
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
    .abortSignal(AbortSignal.timeout(WRITE_TIMEOUT_MS))
    .maybeSingle();
  if (typeof profile?.username === "string") revalidateUserProfile(profile.username);

  return { ok: true, id: data.id };
}
