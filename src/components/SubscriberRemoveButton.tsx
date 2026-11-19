"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeNewsletterSubscriber } from "@/app/admin/subscribers/actions";

export default function SubscriberRemoveButton({ id, email }: { id: string; email: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRemove() {
    const confirmed = window.confirm(
      `Remove ${email} from the newsletter list? This deletes the address.`
    );
    if (!confirmed) return;

    setPending(true);
    setError(null);
    const result = await removeNewsletterSubscriber(id);
    if (!result.ok) {
      setPending(false);
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={onRemove}
        aria-label={`Remove ${email}`}
        className="field-button min-h-11 rounded border border-red-700 bg-white px-3 text-sm font-medium text-red-700 disabled:opacity-60"
      >
        {pending ? "Removing..." : "Remove"}
      </button>
      {error ? (
        <p role="alert" className="mt-1 max-w-48 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
