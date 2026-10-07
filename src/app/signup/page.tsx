"use client";

import { useState } from "react";
import Link from "next/link";
import PasswordInput from "@/components/PasswordInput";
import { signUpAccount } from "@/app/signup/actions";

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signUpAccount(new FormData(e.currentTarget));

    setLoading(false);
    if (!result.ok) {
      setError(result.error);
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
            name="username"
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
          <label htmlFor="signup-password" className="field-label">
            Password
          </label>
          <PasswordInput
            id="signup-password"
            name="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <label className="flex items-start gap-2 text-sm leading-relaxed text-[#1a1a1a]">
          <input
            name="ageConfirmed"
            type="checkbox"
            required
            className="mt-1 h-4 w-4 accent-[#3f679b]"
          />
          <span>
            I am at least 13 years old and agree to the{" "}
            <Link href="/terms" className="text-[#3f679b] underline">
              Terms of Use
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-[#3f679b] underline">
              Privacy Policy
            </Link>
          </span>
        </label>

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
