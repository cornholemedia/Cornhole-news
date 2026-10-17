"use server";

import { fieldValue } from "@/lib/form-fields";
import { friendlyWriteError, cleanPostBody, cleanPostTitle, safePostUrl } from "@/lib/post-fields";
import { recordIpAttempt } from "@/lib/rate-limit";
import { requestClientIp, requestIpHash } from "@/lib/request-ip";
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

  const { data, error } = await supabase
    .from("posts")
    .insert({
      title,
      url,
      body: body || null,
      is_political: formData.get("isPolitical") === "on",
      author_id: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: friendlyWriteError(error?.message ?? "") };
  }

  return { ok: true, id: data.id };
}
