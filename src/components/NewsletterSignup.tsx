"use client";

import { useActionState } from "react";
import { usePathname } from "next/navigation";
import HoneypotField from "@/components/HoneypotField";
import { subscribeToNewsletter } from "@/app/newsletter/actions";
import type { FormStatus } from "@/lib/form-fields";

const initialState: FormStatus = { ok: false };

export default function NewsletterSignup() {
  const [state, formAction, pending] = useActionState(subscribeToNewsletter, initialState);
  const pathname = usePathname() || "/";

  return (
    <section
      aria-labelledby="newsletter-heading"
      className="w-full max-w-xl rounded border border-[#e0e0e0] bg-white px-4 py-4 text-left text-[#1a1a1a]"
    >
      <h2 id="newsletter-heading" className="text-[15px] font-medium leading-snug">
        Get Midwest news in your inbox.
      </h2>

      {state.ok ? (
        <p role="status" className="mt-3 text-[15px] leading-relaxed">
          {state.message ?? "Thanks. You're subscribed. We'll send Midwest news to that inbox."}
        </p>
      ) : (
        <form action={formAction} className="relative mt-3">
          <HoneypotField />
          <input type="hidden" name="source" value={pathname} />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor="newsletter-email" className="field-label">
                Email
              </label>
              <input
                id="newsletter-email"
                name="email"
                type="email"
                required
                maxLength={320}
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="email"
                placeholder="you@example.com"
                disabled={pending}
                aria-invalid={state.error ? true : undefined}
                aria-describedby={state.error ? "newsletter-error" : undefined}
                className="field-input min-h-11"
              />
            </div>
            <button
              type="submit"
              disabled={pending}
              className="field-button min-h-11 w-full shrink-0 rounded bg-[#3f679b] px-4 text-[15px] font-medium text-white hover:bg-[#345580] disabled:opacity-60 sm:w-auto"
            >
              {pending ? "Subscribing..." : "Subscribe"}
            </button>
          </div>

          {state.error ? (
            <p
              id="newsletter-error"
              role="alert"
              className="mt-3 rounded border border-red-700 bg-white p-3 text-sm text-red-700"
            >
              {state.error}
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}
