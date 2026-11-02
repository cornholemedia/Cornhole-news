"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  beginTotpEnrollment,
  removeTotpFactor,
  verifyTotpEnrollment,
} from "@/app/admin/security/actions";

type VerifiedFactor = {
  id: string;
  friendlyName: string;
};

export default function AdminMfaSetup({
  factors,
  requireEnrollment,
}: {
  factors: VerifiedFactor[];
  requireEnrollment: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(factors);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await beginTotpEnrollment();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFactorId(result.factorId);
    setQr(result.qr);
    setSecret(result.secret);
    setCode("");
  }

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const result = await verifyTotpEnrollment(factorId, code);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFactorId(null);
    setQr(null);
    setSecret(null);
    setCode("");
    setMessage("Authenticator app is on.");
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this authenticator app? You can set up a new one next.")) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await removeTotpFactor(id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRows((current) => current.filter((factor) => factor.id !== id));
    setMessage("Authenticator app removed. Set up a new one when you are ready.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {requireEnrollment && rows.length === 0 ? (
        <p className="rounded border border-[#e0e0e0] bg-white p-4 text-sm text-[#1a1a1a]">
          Set up an authenticator app before using the rest of the admin pages.
        </p>
      ) : null}

      {rows.length > 0 ? (
        <ul className="space-y-3">
          {rows.map((factor) => (
            <li key={factor.id} className="rounded border border-[#e0e0e0] bg-white p-4">
              <p className="font-semibold">{factor.friendlyName}</p>
              <p className="mt-1 text-sm text-[#3a3a3a]">
                This account asks for a code after the password.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void remove(factor.id);
                }}
                className="field-button mt-3 min-h-11 rounded border border-red-700 bg-white px-3 text-sm font-medium text-red-700 disabled:opacity-60"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {rows.length === 0 && !qr ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void start();
          }}
          className="field-button min-h-11 rounded bg-[#3f679b] px-3 text-sm font-medium text-white hover:bg-[#345580] disabled:opacity-60"
        >
          {busy ? "Starting..." : "Set up authenticator"}
        </button>
      ) : null}

      {qr && secret ? (
        <form onSubmit={confirm} className="rounded border border-[#e0e0e0] bg-white p-4">
          <p className="text-sm text-[#1a1a1a]">
            Scan this QR code with your authenticator app, or enter the secret by hand.
            Then enter the 6-digit code to turn it on.
          </p>
          {/* The QR is a data URL from Supabase Auth, not a remote image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Authenticator QR code" className="mt-3 h-40 w-40 bg-white" />
          <p className="mt-3 text-xs uppercase tracking-wide text-[#666]">Secret</p>
          <p className="mt-1 font-mono text-sm break-all text-[#1a1a1a]">{secret}</p>
          <label htmlFor="enroll-code" className="field-label mt-4">
            6-digit code
          </label>
          <input
            id="enroll-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="[0-9]*"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="field-input max-w-40"
            required
          />
          <button
            type="submit"
            disabled={busy}
            className="field-button mt-3 min-h-11 rounded bg-[#3f679b] px-3 text-sm font-medium text-white hover:bg-[#345580] disabled:opacity-60"
          >
            {busy ? "Checking..." : "Verify and turn on"}
          </button>
        </form>
      ) : null}

      {message ? (
        <p role="status" className="text-sm text-[#2f6b3a]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
