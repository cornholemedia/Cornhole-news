"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PasswordInput from "@/components/PasswordInput";
import { createClient } from "@/lib/supabase/client";
import { PASSWORD_MIN_LENGTH } from "@/lib/passwords";
import {
  normalizeTotpCode,
  resetMfaError,
  resetStepFromAssurance,
  sessionExpiredMessage,
  type ResetStep,
} from "@/lib/reset-password";

const LINK_ERRORS: Record<string, string> = {
  invalid_link: "This reset link is invalid or has expired. Request a new one and try again.",
  same_browser:
    "Open the reset link in the same browser you used to request it, or request a new link.",
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-sm text-sm text-[#666]">Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const [supabase] = useState(() => createClient());
  const searchParams = useSearchParams();
  const linkError = LINK_ERRORS[searchParams.get("error") ?? ""] ?? null;
  const [ready, setReady] = useState<ResetStep | "loading">("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!active) return;
      if (userError || !userData.user) {
        setReady((current) => (current === "password" || current === "mfa" ? current : "signed_out"));
        return;
      }

      const { data: assurance, error: assuranceError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!active) return;
      if (assuranceError || !assurance) {
        if (assuranceError && sessionExpiredMessage(assuranceError.message)) {
          setReady("signed_out");
          setError("This reset link is invalid or has expired. Request a new one and try again.");
          return;
        }
        setError(assuranceError?.message ?? "The reset session could not be checked.");
        setReady("signed_out");
        return;
      }

      const step = resetStepFromAssurance({
        hasSession: true,
        currentLevel: assurance.currentLevel,
        nextLevel: assurance.nextLevel,
      });
      if (step !== "mfa") {
        setReady(step);
        return;
      }

      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (!active) return;
      const totp = factors?.totp?.[0];
      if (factorsError || !totp?.id) {
        setError(
          factorsError
            ? resetMfaError(factorsError.message)
            : "This account needs an authenticator code, but no authenticator app is available."
        );
        setReady("mfa");
        return;
      }
      setFactorId(totp.id);
      setReady("mfa");
    }

    void load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) {
        void load();
      }
      if (event === "SIGNED_OUT") {
        setReady((current) => (current === "password" ? current : "signed_out"));
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const normalized = normalizeTotpCode(code);
    if (!normalized) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    if (!factorId) {
      setError("This account needs an authenticator code, but no authenticator app is available.");
      return;
    }

    setLoading(true);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: normalized,
    });
    if (verifyError) {
      setLoading(false);
      setError(resetMfaError(verifyError.message));
      if (sessionExpiredMessage(verifyError.message)) setReady("signed_out");
      return;
    }

    const { data: assurance, error: assuranceError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setLoading(false);
    if (assuranceError || assurance?.currentLevel !== "aal2") {
      setError(
        assuranceError
          ? resetMfaError(assuranceError.message)
          : "The authenticator check did not finish. Enter the code again."
      );
      return;
    }

    setCode("");
    setReady("password");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { data: assurance, error: assuranceError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || !assurance) {
      setLoading(false);
      if (assuranceError && sessionExpiredMessage(assuranceError.message)) {
        setReady("signed_out");
        setError("This reset link is invalid or has expired. Request a new one and try again.");
        return;
      }
      setError(assuranceError?.message ?? "The reset session could not be checked.");
      return;
    }

    const step = resetStepFromAssurance({
      hasSession: true,
      currentLevel: assurance.currentLevel,
      nextLevel: assurance.nextLevel,
    });
    if (step === "mfa") {
      setLoading(false);
      setReady("mfa");
      setError("Enter the code from your authenticator app before changing the password.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setLoading(false);
      if (/aal2/i.test(updateError.message)) {
        setReady("mfa");
        setError(resetMfaError(updateError.message));
        return;
      }
      if (sessionExpiredMessage(updateError.message)) {
        setReady("signed_out");
        setError("This reset link is invalid or has expired. Request a new one and try again.");
        return;
      }
      setError(updateError.message);
      return;
    }

    // updateUser does not sign this browser out. scope "others" revokes every
    // other session and leaves the one that just set the password logged in.
    const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
    setLoading(false);
    if (signOutError) {
      setError(
        "Your password was updated, but other signed-in devices could not be signed out. Please try again."
      );
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="mb-4 text-2xl font-bold">Password updated</h1>
        <p className="text-[15px] leading-relaxed text-[#666]">
          Your password has been changed, and other devices have been signed out. You&apos;re
          still logged in here and can{" "}
          <Link href="/" className="text-[#3f679b] hover:underline">
            continue to Cornhole News
          </Link>
          .
        </p>
      </div>
    );
  }

  if (!linkError && ready === "loading") {
    return <div className="mx-auto max-w-sm text-sm text-[#666]">Loading...</div>;
  }

  if (linkError || ready === "signed_out") {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="mb-4 text-2xl font-bold">Set a new password</h1>
        {(linkError || error) && (
          <p role="alert" className="mb-3 text-sm text-red-600">
            {linkError ?? error}
          </p>
        )}
        <p className="text-[15px] leading-relaxed text-[#666]">
          Request a reset link, then open it from your email to choose a new password.
        </p>
        <p className="mt-4 text-sm text-[#666]">
          <Link href="/forgot-password" className="text-[#3f679b] hover:underline">
            Forgot password?
          </Link>
        </p>
      </div>
    );
  }

  if (ready === "mfa") {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="mb-4 text-2xl font-bold">Authenticator code</h1>
        <p className="mb-4 text-[15px] leading-relaxed text-[#666]">
          This reset link is not enough to change the password. Enter the 6-digit code from
          your authenticator app. The new password comes after that.
        </p>
        <form onSubmit={verifyCode} className="space-y-3">
          <div>
            <label htmlFor="reset-mfa-code" className="field-label">
              6-digit code
            </label>
            <input
              id="reset-mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]*"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="field-input text-base"
              required
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading || !factorId}
            className="field-button min-h-11 w-full rounded bg-[#3f679b] px-4 py-2 text-[15px] font-medium text-white hover:bg-[#345580] disabled:opacity-60"
          >
            {loading ? "Checking..." : "Continue"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-4 text-2xl font-bold">Set a new password</h1>
      <p className="mb-4 text-[15px] leading-relaxed text-[#666]">Choose a new password for your account.</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="new-password" className="field-label">
            New password
          </label>
          <PasswordInput
            id="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="field-label">
            Confirm password
          </label>
          <PasswordInput
            id="confirm-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="field-button min-h-11 w-full rounded bg-[#3f679b] px-4 py-2 text-[15px] font-medium text-white hover:bg-[#345580] disabled:opacity-60"
        >
          {loading ? "Updating..." : "Update password"}
        </button>
      </form>
    </div>
  );
}
