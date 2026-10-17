"use server";

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/passwords";
import { recordIpAttempt } from "@/lib/rate-limit";
import { requestClientIp, requestIpHash } from "@/lib/request-ip";
import { getSiteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { TURNSTILE_FIELD, prepareAuthCaptchaToken } from "@/lib/turnstile";
import { fieldValue } from "@/lib/form-fields";

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

export async function signUpAccount(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (formData.get("ageConfirmed") !== "on") {
    return {
      ok: false,
      error:
        "Confirm that you are at least 13 years old and agree to the Terms of Use and Privacy Policy.",
    };
  }

  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      error: "Username must be 3 to 20 characters: letters, numbers, and underscores only.",
    };
  }

  if (username.toLowerCase() === "cornhole_admin") {
    return { ok: false, error: "That username is reserved." };
  }

  if (!email || !email.includes("@") || email.length > 320) {
    return { ok: false, error: "Enter a valid email address." };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` };
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, error: `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.` };
  }

  const captcha = await prepareAuthCaptchaToken(
    fieldValue(formData.get(TURNSTILE_FIELD)),
    await requestClientIp()
  );
  if (!captcha.ok) return captcha;

  const limited = await recordIpAttempt("signup", await requestIpHash());
  if (!limited.ok) return limited;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${getSiteUrl()}/auth/callback`,
        captchaToken: captcha.captchaToken,
        data: {
          username,
          age_confirmed: true,
        },
      },
    });

    if (error) {
      const message = error.message.toLowerCase().includes("at least 13")
        ? "Confirm that you are at least 13 years old and agree to the Terms of Use and Privacy Policy."
        : error.message.toLowerCase().includes("reserved")
          ? "That username is reserved."
          : error.message;
      return { ok: false, error: message };
    }

    return { ok: true };
  } catch (error) {
    console.error("Signup failed:", error instanceof Error ? error.message : "unknown error");
    return { ok: false, error: "Could not create the account. Please try again." };
  }
}
