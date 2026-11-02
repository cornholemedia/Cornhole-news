"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { verifyAdminMfa } from "@/app/admin/security/actions";

export default function AdminMfaChallenge({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await verifyAdminMfa(code);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(nextPath);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-sm">
      <h1 className="mb-2 text-2xl font-bold">Authenticator code</h1>
      <p className="mb-4 text-sm text-[#666]">
        Enter the 6-digit code from your authenticator app.
      </p>
      <label htmlFor="mfa-code" className="field-label">
        6-digit code
      </label>
      <input
        id="mfa-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        pattern="[0-9]*"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        className="field-input"
        required
      />
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="field-button mt-4 min-h-11 w-full rounded bg-[#3f679b] px-3 text-sm font-medium text-white hover:bg-[#345580] disabled:opacity-60"
      >
        {busy ? "Checking..." : "Continue"}
      </button>
    </form>
  );
}
