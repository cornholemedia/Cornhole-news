"use client";

import { useState } from "react";
import Link from "next/link";
import PasswordInput from "@/components/PasswordInput";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const supabase = createClient();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });

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
        <h1 className="mb-4 text-2xl font-bold">Check your email</h1>
        <p className="text-[15px] text-[#666]">
          We sent a confirmation link to <strong>{email}</strong>. Click it, then{" "}
          <Link href="/login" className="text-[#3f679b] hover:underline">
            log in
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-4 text-2xl font-bold">Sign up</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="signup-username" className="field-label">
            Username
          </label>
          <input
            id="signup-username"
            type="text"
            required
            minLength={3}
            maxLength={20}
            pattern="[a-zA-Z0-9_]+"
            title="Letters, numbers, and underscores only"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="signup-email" className="field-label">
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="signup-password" className="field-label">
            Password
          </label>
          <PasswordInput
            id="signup-password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="field-button w-full rounded bg-[#3f679b] px-4 py-2 text-[15px] font-medium text-white hover:bg-[#345580] disabled:opacity-60"
        >
          {loading ? "Signing up..." : "Sign up"}
        </button>
      </form>

      <p className="mt-4 text-sm text-[#666]">
        Already have an account?{" "}
        <Link href="/login" className="text-[#3f679b] hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
