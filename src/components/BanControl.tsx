"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setUserBanned } from "@/app/user/ban-action";

type BanControlProps = {
  userId: string;
  username: string;
  isBanned: boolean;
};

export default function BanControl({ userId, username, isBanned }: BanControlProps) {
  const router = useRouter();
  const [banned, setBanned] = useState(isBanned);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    const next = !banned;
    const label = next ? `Ban ${username}? They will not be able to post, comment, or vote.` : `Unban ${username}?`;
    if (!window.confirm(label)) return;

    setPending(true);
    setError(null);
    const result = await setUserBanned(userId, username, next);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBanned(next);
    router.refresh();
  }

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="field-button rounded border border-red-700 bg-white px-3 py-1.5 text-sm font-medium text-red-700 disabled:opacity-60"
      >
        {pending ? "Saving..." : banned ? "Unban" : "Ban"}
      </button>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
