"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import TurnstileField from "@/components/TurnstileField";
import { requestPasswordReset } from "@/app/forgot-password/actions";

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-sm text-sm text-[#666]">Loading...</div>}>
      <ForgotPasswordForm />
    </Suspense>
  );
}

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") ?? "";
  const [email, setEmail] = useState(initialEmail.length > 320 ? "" : initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [turnstileKey, setTurnstileKey] = useState(0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await requestPasswordReset(new FormData(e.currentTarget));
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      setTurnstileKey((key) => key + 1);
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
          <label htmlFor="forgot-email" className="field-label">
            Email
          </label>
          <input
            id="forgot-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input"
          />
        </div>

        <TurnstileField resetKey={String(turnstileKey)} />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="field-button w-full rounded bg-[#3f679b] px-4 py-2 text-[15px] font-medium text-white hover:bg-[#345580] disabled:opacity-60"
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
