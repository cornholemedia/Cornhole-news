"use server";

import { fieldValue } from "@/lib/form-fields";
import { requestClientIp } from "@/lib/request-ip";
import { getSiteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { TURNSTILE_FIELD, prepareAuthCaptchaToken } from "@/lib/turnstile";

export async function requestPasswordReset(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = fieldValue(formData.get("email")).trim();
  if (!email || !email.includes("@") || email.length > 320) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const captcha = await prepareAuthCaptchaToken(
    fieldValue(formData.get(TURNSTILE_FIELD)),
    await requestClientIp()
  );
  if (!captcha.ok) return captcha;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getSiteUrl()}/auth/callback`,
      captchaToken: captcha.captchaToken,
    });

    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("user not found") || message.includes("not registered")) {
        return { ok: true };
      }
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error) {
    console.error(
      "Password reset failed:",
      error instanceof Error ? error.message : "unknown error"
    );
    return { ok: false, error: "Could not send the reset email. Please try again." };
  }
}
