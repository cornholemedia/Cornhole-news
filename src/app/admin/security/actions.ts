"use server";

import { normalizeTotpCode, qrImageSrc } from "@/lib/admin-mfa";
import { readAdminAssurance } from "@/lib/admin-session";
import { createClient } from "@/lib/supabase/server";

export type MfaActionResult = { ok: true } | { ok: false; error: string };

export type EnrollmentStart =
  | { ok: true; factorId: string; qr: string; secret: string }
  | { ok: false; error: string };

async function adminUser() {
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

  const assurance = await readAdminAssurance(supabase);
  return { supabase, error: null, assurance };
}

function mfaError(message: string): string {
  if (/mfa.*disabled|not enabled|factor type/i.test(message)) {
    return "Authenticator setup is turned off in Supabase. In Authentication, open Multi-Factor and enable TOTP.";
  }
  if (/invalid|challenge|otp|code/i.test(message)) {
    return "That code didn't match. Wait for the next one and try again.";
  }
  return "That authenticator step could not be saved.";
}

export async function beginTotpEnrollment(): Promise<EnrollmentStart> {
  const gate = await adminUser();
  if (!gate.supabase || gate.error) {
    return { ok: false, error: gate.error ?? "You need an admin account to do that." };
  }

  if (gate.assurance.hasVerifiedFactor) {
    if (gate.assurance.currentLevel !== "aal2") {
      return { ok: false, error: "Enter the code from your authenticator app first." };
    }
    return { ok: false, error: "Remove the current authenticator before setting up a new one." };
  }

  const { data: listed, error: listError } = await gate.supabase.auth.mfa.listFactors();
  if (listError) {
    console.error("Could not list authenticator factors:", listError.message);
    return { ok: false, error: mfaError(listError.message) };
  }

  for (const factor of listed?.all ?? []) {
    if (factor.status === "unverified") {
      const { error: dropError } = await gate.supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (dropError) {
        console.error("Could not clear an unfinished authenticator:", dropError.message);
        return { ok: false, error: mfaError(dropError.message) };
      }
    }
  }

  const { data, error } = await gate.supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Authenticator app",
    issuer: "Cornhole News",
  });

  if (error || !data || data.type !== "totp") {
    console.error("Could not start authenticator enrollment:", error?.message ?? "no factor");
    return { ok: false, error: mfaError(error?.message ?? "") };
  }

  const qr = qrImageSrc(data.totp.qr_code);
  const secret = data.totp.secret?.trim();
  if (!qr || !secret) {
    return { ok: false, error: "The authenticator setup did not include a QR code." };
  }

  return { ok: true, factorId: data.id, qr, secret };
}

export async function verifyTotpEnrollment(factorId: string, code: string): Promise<MfaActionResult> {
  if (!/^[0-9a-f-]{36}$/i.test(factorId)) {
    return { ok: false, error: "That authenticator could not be found." };
  }
  const normalized = normalizeTotpCode(code);
  if (!normalized) return { ok: false, error: "Enter the 6-digit code from your app." };

  const gate = await adminUser();
  if (!gate.supabase || gate.error) {
    return { ok: false, error: gate.error ?? "You need an admin account to do that." };
  }

  const challenged = await gate.supabase.auth.mfa.challenge({ factorId });
  if (challenged.error || !challenged.data) {
    console.error("Could not challenge authenticator enrollment:", challenged.error?.message);
    return { ok: false, error: mfaError(challenged.error?.message ?? "") };
  }

  const verified = await gate.supabase.auth.mfa.verify({
    factorId,
    challengeId: challenged.data.id,
    code: normalized,
  });
  if (verified.error) {
    console.error("Could not verify authenticator enrollment:", verified.error.message);
    return { ok: false, error: mfaError(verified.error.message) };
  }

  return { ok: true };
}

export async function verifyAdminMfa(code: string): Promise<MfaActionResult> {
  const normalized = normalizeTotpCode(code);
  if (!normalized) return { ok: false, error: "Enter the 6-digit code from your app." };

  const gate = await adminUser();
  if (!gate.supabase || gate.error) {
    return { ok: false, error: gate.error ?? "You need an admin account to do that." };
  }
  if (!gate.assurance.hasVerifiedFactor) {
    return { ok: false, error: "Set up an authenticator app before entering a code." };
  }

  const { data: listed, error: listError } = await gate.supabase.auth.mfa.listFactors();
  const factor = listed?.totp.find((item) => item.status === "verified");
  if (listError || !factor) {
    console.error("Could not find a verified authenticator:", listError?.message ?? "none");
    return { ok: false, error: "Set up an authenticator app before entering a code." };
  }

  const challenged = await gate.supabase.auth.mfa.challenge({ factorId: factor.id });
  if (challenged.error || !challenged.data) {
    console.error("Could not challenge authenticator sign-in:", challenged.error?.message);
    return { ok: false, error: mfaError(challenged.error?.message ?? "") };
  }

  const verified = await gate.supabase.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenged.data.id,
    code: normalized,
  });
  if (verified.error) {
    console.error("Could not verify authenticator sign-in:", verified.error.message);
    return { ok: false, error: mfaError(verified.error.message) };
  }

  return { ok: true };
}

export async function removeTotpFactor(factorId: string): Promise<MfaActionResult> {
  if (!/^[0-9a-f-]{36}$/i.test(factorId)) {
    return { ok: false, error: "That authenticator could not be found." };
  }

  const gate = await adminUser();
  if (!gate.supabase || gate.error) {
    return { ok: false, error: gate.error ?? "You need an admin account to do that." };
  }
  if (gate.assurance.hasVerifiedFactor && gate.assurance.currentLevel !== "aal2") {
    return { ok: false, error: "Enter the code from your authenticator app first." };
  }

  const { error } = await gate.supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    console.error("Could not remove authenticator:", error.message);
    return { ok: false, error: mfaError(error.message) };
  }
  return { ok: true };
}
