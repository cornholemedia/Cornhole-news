"use server";

import { fieldValue } from "@/lib/form-fields";
import { safeNextPath } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";
import { TURNSTILE_FIELD, prepareAuthCaptchaToken } from "@/lib/turnstile";
import { requestClientIp } from "@/lib/request-ip";

export async function signInAccount(
  formData: FormData
): Promise<{ ok: true; next: string } | { ok: false; error: string }> {
  const email = fieldValue(formData.get("email")).trim();
  const password = fieldValue(formData.get("password"));

  if (!email || !password) {
    return { ok: false, error: "Enter your email and password." };
  }

  const captcha = await prepareAuthCaptchaToken(
    fieldValue(formData.get(TURNSTILE_FIELD)),
    await requestClientIp()
  );
  if (!captcha.ok) return captcha;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken: captcha.captchaToken },
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true, next: safeNextPath(fieldValue(formData.get("next"))) };
  } catch (error) {
    console.error("Login failed:", error instanceof Error ? error.message : "unknown error");
    return { ok: false, error: "Could not log in. Please try again." };
  }
}
