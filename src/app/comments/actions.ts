"use server";

import { fieldValue } from "@/lib/form-fields";
import { friendlyWriteError } from "@/lib/post-fields";
import { recordIpAttempt } from "@/lib/rate-limit";
import { requestClientIp, requestIpHash } from "@/lib/request-ip";
import { createClient } from "@/lib/supabase/server";
import { TURNSTILE_FIELD, verifyTurnstileToken } from "@/lib/turnstile";

export async function submitComment(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const postId = Number(fieldValue(formData.get("postId")));
  if (!Number.isInteger(postId) || postId <= 0) {
    return { ok: false, error: "That story could not be found." };
  }

  const body = fieldValue(formData.get("body")).replace(/\r\n/g, "\n").trim();
  if (!body || body.length > 5000 || body.includes("\u0000")) {
    return { ok: false, error: "Enter a comment, up to 5,000 characters." };
  }

  const human = await verifyTurnstileToken(
    fieldValue(formData.get(TURNSTILE_FIELD)),
    await requestClientIp()
  );
  if (!human.ok) return human;

  const limited = await recordIpAttempt("comment", await requestIpHash());
  if (!limited.ok) return limited;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Log in to comment." };

  const { error } = await supabase.from("comments").insert({
    post_id: postId,
    author_id: user.id,
    body,
  });

  if (error) return { ok: false, error: friendlyWriteError(error.message) };
  return { ok: true };
}
