"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PasswordInput from "@/components/PasswordInput";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/safe-next";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    router.push(safeNextPath(next));
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-4 text-2xl font-bold">Log in</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="login-email" className="field-label">
            Email
          </label>
          <input
            id="login-email"
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
