"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PasswordInput from "@/components/PasswordInput";
import TurnstileField from "@/components/TurnstileField";
import { signInAccount } from "@/app/login/actions";
import { safeNextPath } from "@/lib/safe-next";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-sm text-sm text-[#666]">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const confirmError = searchParams.get("error") === "confirm";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    confirmError ? "That confirmation link is invalid or has expired. Log in if you already confirmed, or sign up again." : null
  );
  const [loading, setLoading] = useState(false);
  const [turnstileKey, setTurnstileKey] = useState(0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signInAccount(new FormData(e.currentTarget));
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      setTurnstileKey((key) => key + 1);
      return;
    }

    router.push(result.next);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-4 text-2xl font-bold">Log in</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input type="hidden" name="next" value={nextPath} />
        <div>
          <label htmlFor="login-email" className="field-label">
            Email
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="field-label">
            Password
          </label>
          <PasswordInput
            id="login-password"
            name="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="mt-1 text-right">
            <Link
              href={
                email.trim()
                  ? `/forgot-password?email=${encodeURIComponent(email.trim())}`
                  : "/forgot-password"
              }
              className="text-sm text-[#3f679b] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <TurnstileField resetKey={String(turnstileKey)} />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="field-button w-full rounded bg-[#3f679b] px-4 py-2 text-[15px] font-medium text-white hover:bg-[#345580] disabled:opacity-60"
        >
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>

      <p className="mt-4 text-sm text-[#666]">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-[#3f679b] hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
