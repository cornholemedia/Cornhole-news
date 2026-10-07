"use client";

import { useActionState } from "react";
import HoneypotField from "@/components/HoneypotField";
import { submitContact } from "@/app/contact/actions";
import type { FormStatus } from "@/lib/form-fields";

const initialState: FormStatus = { ok: false };

export default function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContact, initialState);

  return (
    <section className="mt-8 rounded border border-[#e0e0e0] bg-white p-5">
      <h2 className="text-lg font-semibold">Send a message</h2>
      <p className="mb-4 mt-1 text-sm text-[#666]">
        Name, email, and a message are required. Subject is optional.
      </p>

      {state.ok ? (
        <p
          role="status"
          className="rounded border border-[#2f6b3a] bg-white p-4 text-[15px] leading-relaxed text-[#1a1a1a]"
        >
          Thanks. We received your message and will reply to the email address you entered.
        </p>
      ) : (
        <form action={formAction} className="relative space-y-3">
          <HoneypotField />
          <div>
            <label htmlFor="contact-name" className="field-label">
              Name
            </label>
            <input
              id="contact-name"
              name="name"
              type="text"
              required
              maxLength={200}
              autoComplete="name"
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="contact-email" className="field-label">
              Email
            </label>
            <input
              id="contact-email"
              name="email"
              type="email"
              required
              maxLength={320}
              autoComplete="email"
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="contact-subject" className="field-label">
              Subject <span className="text-[#5c5c5c]">(optional)</span>
            </label>
            <input
              id="contact-subject"
              name="subject"
              type="text"
              maxLength={200}
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="contact-message" className="field-label">
              Message
            </label>
            <textarea
              id="contact-message"
              name="message"
              required
              rows={6}
              maxLength={5000}
              className="field-input"
            />
          </div>

          {state.error ? (
            <p role="alert" className="rounded border border-red-700 bg-white p-3 text-sm text-red-700">
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="field-button rounded bg-[#3f679b] px-4 py-2 text-[15px] font-medium text-white hover:bg-[#345580] disabled:opacity-60"
          >
            {pending ? "Sending..." : "Send message"}
          </button>
        </form>
      )}
    </section>
  );
}
