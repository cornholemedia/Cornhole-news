"use server";

import { revalidatePath } from "next/cache";
import {
  DIGEST_BOT_USERNAME,
  DIGEST_DRIP_HINT,
  DIGEST_MIGRATION_HINT,
  DIGEST_POLITICS_HINT,
  DIGEST_PUBLISH_ONE_HINT,
  DIGEST_STATE_HINT,
  DIGEST_TWEET_HINT,
  missingDigestSchema,
  parseDigestDate,
} from "@/lib/digest";
import {
  chicagoDayBounds,
  compareReviewOrder,
  formatDripMessage,
  missingDripRelease,
  planDripRelease,
  type DripExisting,
} from "@/lib/drip-schedule";
import { cleanStoryState } from "@/lib/story-state";
import { cleanTweetDraft } from "@/lib/tweet";
import { adminClient } from "@/lib/admin-session";
import { revalidatePublicStories, revalidateUserProfile } from "@/lib/revalidate-public";

export type DigestActionResult =
  | { ok: true; message: string; postId?: number }
  | { ok: false; error: string };

const STORY_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function actionError(error: { message: string; code?: string }): string {
  if (/several stories|too many|suspended|banned/i.test(error.message)) {
    return error.message;
  }
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
  if (
    /tweet_draft|set_digest_story_tweet_draft/i.test(error.message) &&
    /column|schema cache|does not exist|function/i.test(error.message)
  ) {
    return DIGEST_TWEET_HINT;
  }
  if (
    /story_state|set_digest_story_state/i.test(error.message) &&
    /column|schema cache|does not exist|function/i.test(error.message)
  ) {
    return DIGEST_STATE_HINT;
  }
  if (/schedule-changed/i.test(error.message)) return "The schedule changed. Publish again.";
  if (missingDripRelease(error.message)) return DIGEST_DRIP_HINT;
  if (/publish_digest_story/i.test(error.message)) return DIGEST_PUBLISH_ONE_HINT;
  if (missingDigestSchema(error.message)) return DIGEST_MIGRATION_HINT;
  return "That could not be saved.";
}

function revalidateDigest(published: boolean, postId?: number) {
  revalidatePath("/admin");
  revalidatePath("/admin/review");
  if (!published) return;
  revalidatePublicStories(postId);
  revalidateUserProfile(DIGEST_BOT_USERNAME);
}

const MAX_SCHEDULE = 100;

type ScheduledRow = {
  story_id: string;
  post_id: number;
  publish_at: string;
};

function asScheduled(data: unknown): ScheduledRow[] {
  let value = data;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  const rows: ScheduledRow[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const storyId = typeof record.story_id === "string" ? record.story_id : "";
    const postId = Number(record.post_id);
    const publishAt = typeof record.publish_at === "string" ? record.publish_at : "";
    if (!STORY_ID.test(storyId) || !Number.isInteger(postId) || postId <= 0 || !publishAt) continue;
    rows.push({ story_id: storyId, post_id: postId, publish_at: publishAt });
  }
  return rows;
}

function revalidateScheduled(rows: readonly ScheduledRow[]) {
  revalidatePath("/admin");
  revalidatePath("/admin/review");
  revalidatePublicStories();
  revalidateUserProfile(DIGEST_BOT_USERNAME);
  const due = Date.now() + 2000;
  for (const row of rows) {
    if (Date.parse(row.publish_at) <= due) revalidatePath(`/item/${row.post_id}`);
  }
}

async function scheduleDigestStories(ids: string[]): Promise<DigestActionResult> {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!STORY_ID.test(id) || seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  if (unique.length === 0) return { ok: false, error: "That story could not be found." };
  if (unique.length > MAX_SCHEDULE) return { ok: false, error: "Schedule up to 100 stories at a time." };

  const { supabase, error } = await adminClient();
  if (error || !supabase) {
    return { ok: false, error: error ?? "You need an admin account to do that." };
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data: storyRows, error: storyError } = await supabase
      .from("digest_stories")
      .select("id, status, section, created_at")
      .in("id", unique);

    if (storyError) {
      console.error("Could not load digest stories to schedule:", storyError.message);
      return { ok: false, error: actionError(storyError) };
    }

    const byId = new Map((storyRows ?? []).map((row) => [row.id, row]));
    for (const id of unique) {
      const row = byId.get(id);
      if (!row || (row.status !== "pending" && row.status !== "published")) {
        return { ok: false, error: "That story is no longer waiting." };
      }
    }

    const incoming = unique
      .map((id) => byId.get(id))
      .filter((row): row is NonNullable<typeof row> => row?.status === "pending")
      .map((row) => ({
        id: row.id,
        section: row.section,
        createdAt: row.created_at,
      }))
      .sort(compareReviewOrder);
    if (incoming.length === 0) return { ok: true, message: "Already published." };

    const now = new Date();
    const bounds = chicagoDayBounds(now);
    const { data: timed, error: timeError } = await supabase
      .from("posts")
      .select("id, publish_at")
      .not("publish_at", "is", null)
      .gte("publish_at", bounds.start.toISOString())
      .lt("publish_at", bounds.end.toISOString());

    if (timeError) {
      console.error("Could not load today's release times:", timeError.message);
      return { ok: false, error: actionError(timeError) };
    }

    const existing: DripExisting[] = [];
    const expected: { post_id: number; publish_at: string }[] = [];
    for (const row of timed ?? []) {
      const postId = Number(row.id);
      const publishAt = typeof row.publish_at === "string" ? row.publish_at : "";
      const parsed = new Date(publishAt);
      if (!Number.isInteger(postId) || postId <= 0 || Number.isNaN(parsed.getTime())) continue;
      existing.push({ postId, publishAt: parsed });
      expected.push({ post_id: postId, publish_at: publishAt });
    }

    const plan = planDripRelease({
      now,
      existing,
      incoming: incoming.map((row) => row.id),
    });
    const publish = plan
      .filter((row): row is typeof row & { storyKey: string } => row.storyKey != null)
      .map((row) => ({ story_id: row.storyKey, publish_at: row.publishAt.toISOString() }));
    const move = plan
      .filter((row): row is typeof row & { postId: number } => row.postId != null)
      .map((row) => ({ post_id: row.postId, publish_at: row.publishAt.toISOString() }));

    const { data, error: applyError } = await supabase.rpc("apply_drip_schedule", {
      p_plan: { expected, publish, move },
    });

    if (applyError) {
      if (attempt === 0 && /schedule-changed/i.test(applyError.message)) continue;
      console.error("Could not schedule digest stories:", applyError.message);
      return { ok: false, error: actionError(applyError) };
    }

    const scheduled = asScheduled(data);
    if (scheduled.length === 0) return { ok: false, error: "That story could not be published." };

    revalidateScheduled(scheduled);
    // The database clock can be a couple of seconds ahead of this process.
    // Treat a slot that close as already public.
    const visibleAt = new Date(Date.now() + 5000);
    const live = scheduled.find((row) => Date.parse(row.publish_at) <= visibleAt.getTime());
    return {
      ok: true,
      message: formatDripMessage(
        scheduled.map((row) => new Date(row.publish_at)),
        visibleAt
      ),
      postId: live?.post_id,
    };
  }

  return { ok: false, error: "The schedule changed. Publish again." };
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
  return scheduleDigestStories([id]);
}

export async function publishDigestStories(ids: string[]): Promise<DigestActionResult> {
  if (!Array.isArray(ids)) return { ok: false, error: "That story could not be found." };
  return scheduleDigestStories(ids);
}

export async function releaseDigestStoryNow(id: string): Promise<DigestActionResult> {
  if (!STORY_ID.test(id)) return { ok: false, error: "That story could not be found." };

  const { supabase, error } = await adminClient();
  if (error || !supabase) {
    return { ok: false, error: error ?? "You need an admin account to do that." };
  }

  const { data, error: releaseError } = await supabase.rpc("release_digest_story_now", { p_id: id });
  if (releaseError) {
    console.error("Could not release a digest story:", releaseError.message);
    return { ok: false, error: actionError(releaseError) };
  }

  const postId = Number(data && typeof data === "object" ? (data as { post_id?: unknown }).post_id : NaN);
  if (!Number.isInteger(postId) || postId <= 0) {
    return { ok: false, error: "That story could not be released." };
  }

  revalidateDigest(true, postId);
  return { ok: true, message: "Released. It is on the site now.", postId };
}

export async function unscheduleDigestStory(id: string): Promise<DigestActionResult> {
  if (!STORY_ID.test(id)) return { ok: false, error: "That story could not be found." };

  const { supabase, error } = await adminClient();
  if (error || !supabase) {
    return { ok: false, error: error ?? "You need an admin account to do that." };
  }

  const { data, error: unscheduleError } = await supabase.rpc("unschedule_digest_story", { p_id: id });
  if (unscheduleError) {
    console.error("Could not unschedule a digest story:", unscheduleError.message);
    return { ok: false, error: actionError(unscheduleError) };
  }

  const postId = Number(data && typeof data === "object" ? (data as { post_id?: unknown }).post_id : NaN);
  revalidatePath("/admin");
  revalidatePath("/admin/review");
  revalidatePublicStories(Number.isInteger(postId) && postId > 0 ? postId : undefined);
  revalidateUserProfile(DIGEST_BOT_USERNAME);
  return { ok: true, message: "Unscheduled. It is back in the waiting list and off the site." };
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

  revalidateDigest(postId != null, postId ?? undefined);
  return {
    ok: true,
    message: postId != null ? "Updated the post." : "Saved.",
    postId: postId ?? undefined,
  };
}

export async function setDigestStoryState(
  id: string,
  state: string | null
): Promise<DigestActionResult> {
  if (!STORY_ID.test(id) || (state !== null && typeof state !== "string")) {
    return { ok: false, error: "That story could not be found." };
  }

  const cleaned = cleanStoryState(state ?? "");
  if (!cleaned.ok) return { ok: false, error: cleaned.error };

  const { supabase, error } = await adminClient();
  if (error || !supabase) {
    return { ok: false, error: error ?? "You need an admin account to do that." };
  }

  const { data, error: saveError } = await supabase.rpc("set_digest_story_state", {
    p_id: id,
    p_state: cleaned.value,
  });

  if (saveError) {
    console.error("Could not save a digest story state:", saveError.message);
    return { ok: false, error: actionError(saveError) };
  }

  const postId = data == null ? null : Number(data);
  if (postId != null && (!Number.isInteger(postId) || postId <= 0)) {
    return { ok: false, error: "That story could not be saved." };
  }

  revalidateDigest(postId != null, postId ?? undefined);
  return {
    ok: true,
    message: postId != null ? "Updated the post." : "Saved.",
    postId: postId ?? undefined,
  };
}

export async function saveDigestTweetDraft(
  id: string,
  text: string
): Promise<DigestActionResult> {
  if (!STORY_ID.test(id) || typeof text !== "string") {
    return { ok: false, error: "That story could not be found." };
  }

  const cleaned = cleanTweetDraft(text);
  if (!cleaned.ok) return { ok: false, error: cleaned.error };

  const { supabase, error } = await adminClient();
  if (error || !supabase) {
    return { ok: false, error: error ?? "You need an admin account to do that." };
  }

  const { error: saveError } = await supabase.rpc("set_digest_story_tweet_draft", {
    p_id: id,
    p_tweet_draft: cleaned.value,
  });

  if (saveError) {
    console.error("Could not save a digest tweet:", saveError.message);
    return { ok: false, error: actionError(saveError) };
  }

  return { ok: true, message: "Saved." };
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
  if (count === 1) {
    return { ok: true, message: "Finished. 1 story was deleted and stays off the site." };
  }
  return {
    ok: true,
    message: `Finished. ${count} stories were deleted and stay off the site.`,
  };
}
