"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
  const supabase = createClient();
  const searchParams = useSearchParams();
  const linkError = LINK_ERRORS[searchParams.get("error") ?? ""] ?? null;
  const [ready, setReady] = useState<"loading" | "form" | "signed_out">("loading");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(
      ({ data: { user } }) => {
        if (!active) return;
        setReady((current) => (current === "form" ? current : user ? "form" : "signed_out"));
      },
      () => {
        if (!active) return;
        setReady((current) => (current === "form" ? current : "signed_out"));
      }
    );

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady("form");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="mb-4 text-2xl font-bold">Password updated</h1>
        <p className="text-[15px] text-[#666]">
          Your password has been changed. You&apos;re logged in and can{" "}
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
        {linkError && <p className="mb-3 text-sm text-red-600">{linkError}</p>}
        <p className="text-[15px] text-[#666]">
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

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-4 text-2xl font-bold">Set a new password</h1>
      <p className="mb-4 text-[15px] text-[#666]">Choose a new password for your account.</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm text-[#666]">New password</label>
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-[#e0e0e0] px-3 py-2 text-[15px]"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-[#666]">Confirm password</label>
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded border border-[#e0e0e0] px-3 py-2 text-[15px]"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-[#3f679b] px-4 py-2 text-[15px] font-medium text-white hover:bg-[#345580] disabled:opacity-60"
        >
          {loading ? "Updating..." : "Update password"}
        </button>
      </form>
    </div>
  );
}
