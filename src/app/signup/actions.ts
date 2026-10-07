"use server";

import { createClient } from "@/lib/supabase/server";

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

  if (!email || !email.includes("@") || email.length > 320) {
    return { ok: false, error: "Enter a valid email address." };
  }

  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }

  if (password.length > 72) {
    return { ok: false, error: "Password must be 72 characters or fewer." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          age_confirmed: true,
        },
      },
    });

    if (error) {
      const message = error.message.toLowerCase().includes("at least 13")
        ? "Confirm that you are at least 13 years old and agree to the Terms of Use and Privacy Policy."
        : error.message;
      return { ok: false, error: message };
    }

    return { ok: true };
  } catch (error) {
    console.error("Signup failed:", error instanceof Error ? error.message : "unknown error");
    return { ok: false, error: "Could not create the account. Please try again." };
  }
}
