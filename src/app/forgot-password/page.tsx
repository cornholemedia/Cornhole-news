"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-sm text-sm text-[#666]">Loading...</div>}>
      <ForgotPasswordForm />
    </Suspense>
  );
}

function ForgotPasswordForm() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") ?? "";
  const [email, setEmail] = useState(initialEmail.length > 320 ? "" : initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // No query string: the reset email template appends ?token_hash= to this URL.
    // The path must be on the Supabase redirect allow list. See the README.
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    setLoading(false);
    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("user not found") || message.includes("not registered")) {
        setDone(true);
        return;
      }
      setError(error.message);
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="mb-4 text-2xl font-bold">Check your email</h1>
        <p className="text-[15px] text-[#666]">
          If an account exists for <strong>{email.trim()}</strong>, we sent a link to reset the
          password. Open that link to choose a new one.
        </p>
        <p className="mt-4 text-sm text-[#666]">
          <Link href="/login" className="text-[#3f679b] hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-4 text-2xl font-bold">Forgot password</h1>
      <p className="mb-4 text-[15px] text-[#666]">
        Enter the email you used to sign up and we&apos;ll send you a reset link.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm text-[#666]">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-[#e0e0e0] px-3 py-2 text-[15px]"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-[#3f679b] px-4 py-2 text-[15px] font-medium text-white hover:bg-[#345580] disabled:opacity-60"
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>

      <p className="mt-4 text-sm text-[#666]">
        Remembered it?{" "}
        <Link href="/login" className="text-[#3f679b] hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
