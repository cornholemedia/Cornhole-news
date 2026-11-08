export type ResetStep = "signed_out" | "mfa" | "password";

/** Official AAL gate: aal1 → aal2 means a verified factor exists but this session has not used it. */
export function resetStepFromAssurance(input: {
  hasSession: boolean;
  currentLevel: string | null;
  nextLevel: string | null;
}): ResetStep {
  if (!input.hasSession) return "signed_out";
  if (input.nextLevel === "aal2" && input.currentLevel !== "aal2") return "mfa";
  return "password";
}

export function normalizeTotpCode(value: string): string | null {
  const code = value.replace(/\s+/g, "");
  return /^\d{6}$/.test(code) ? code : null;
}

export function resetMfaError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("aal2")) {
    return "Enter the code from your authenticator app before changing the password.";
  }
  if (
    lower.includes("invalid") ||
    lower.includes("otp") ||
    lower.includes("totp") ||
    lower.includes("challenge") ||
    lower.includes("code")
  ) {
    return "That code didn't match. Wait for the next one from your app and try again.";
  }
  if (lower.includes("expired") || lower.includes("session") || lower.includes("jwt")) {
    return "This reset link is invalid or has expired. Request a new one and try again.";
  }
  return "The authenticator check could not be finished. Try the code again.";
}

export function sessionExpiredMessage(message: string): boolean {
  const lower = message.toLowerCase();
  if (lower.includes("totp") || lower.includes("otp") || lower.includes("aal2")) return false;
  return (
    lower.includes("jwt") ||
    (lower.includes("session") &&
      (lower.includes("expired") || lower.includes("missing") || lower.includes("invalid")))
  );
}
