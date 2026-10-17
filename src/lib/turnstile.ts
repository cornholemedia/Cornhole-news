import "server-only";
import { TURNSTILE_FIELD, TURNSTILE_REQUIRED_ERROR } from "@/lib/turnstile-shared";

export { TURNSTILE_FIELD, TURNSTILE_REQUIRED_ERROR };

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

let loggedMisconfig = false;

function siteKey(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
}

function secret(): string {
  return process.env.TURNSTILE_SECRET_KEY?.trim() ?? "";
}

/** True only when both the public site key and the server secret are set. */
export function turnstileConfigured(): boolean {
  const site = siteKey();
  const key = secret();
  if (site && key) return true;
  if ((site || key) && !loggedMisconfig) {
    loggedMisconfig = true;
    console.error(
      "Turnstile is disabled. Set both NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY, then redeploy."
    );
  }
  return false;
}

/**
 * When this is exactly "true", signup, login, and password reset do not
 * consume the Turnstile token here. Supabase Auth verifies it instead.
 * Turnstile tokens can be checked only once.
 */
export function supabaseAuthCaptchaEnabled(): boolean {
  return process.env.SUPABASE_AUTH_CAPTCHA === "true";
}

type TurnstileResult = { ok: true } | { ok: false; error: string };

export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string | null
): Promise<TurnstileResult> {
  if (!turnstileConfigured()) return { ok: true };

  const response = token.trim();
  if (!response) return { ok: false, error: TURNSTILE_REQUIRED_ERROR };

  const body = new URLSearchParams({
    secret: secret(),
    response,
  });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const result = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    const payload = (await result.json()) as { success?: boolean };
    if (!result.ok || payload.success !== true) {
      return { ok: false, error: TURNSTILE_REQUIRED_ERROR };
    }
    return { ok: true };
  } catch (error) {
    console.error(
      "Turnstile verification failed:",
      error instanceof Error ? error.message : "unknown error"
    );
    return { ok: false, error: "The security check could not be completed. Please try again." };
  }
}

/**
 * Auth calls pass the token through to Supabase when the dashboard captcha
 * is enabled. Otherwise this server verifies it, then still returns it so
 * signUp, signIn, and resetPassword can send captchaToken.
 */
export async function prepareAuthCaptchaToken(
  token: string,
  remoteIp?: string | null
): Promise<{ ok: true; captchaToken?: string } | { ok: false; error: string }> {
  if (!turnstileConfigured()) return { ok: true };

  const value = token.trim();
  if (!value) return { ok: false, error: TURNSTILE_REQUIRED_ERROR };

  if (!supabaseAuthCaptchaEnabled()) {
    const verified = await verifyTurnstileToken(value, remoteIp);
    if (!verified.ok) return verified;
  }

  return { ok: true, captchaToken: value };
}
