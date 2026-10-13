"use server";

import { revalidatePath } from "next/cache";
import {
  DIGEST_MIGRATION_HINT,
  missingDigestSchema,
  parseDigestDate,
} from "@/lib/digest";
import { createClient } from "@/lib/supabase/server";

export type DigestActionResult =
  | { ok: true; message: string }
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

export async function publishDigestDate(digestDate: string): Promise<DigestActionResult> {
  const date = parseDigestDate(digestDate);
  if (!date) return { ok: false, error: "Choose a digest date." };

  const { supabase, error } = await adminClient();
  if (error || !supabase) {
    return { ok: false, error: error ?? "You need an admin account to do that." };
  }

  const { data, error: publishError } = await supabase.rpc("publish_digest_stories", {
    p_digest_date: date,
  });

  if (publishError) {
    console.error("Could not publish digest stories:", publishError.message);
    return { ok: false, error: actionError(publishError) };
  }

  const published = Number(data) || 0;
  revalidateDigest(published > 0);

  if (published === 0) {
    return { ok: true, message: "Nothing was waiting for that date." };
  }

  const noun = published === 1 ? "story" : "stories";
  const more = published === 500 ? " If more are still waiting, publish again." : "";
  return { ok: true, message: `Published ${published} ${noun}.${more}` };
}
