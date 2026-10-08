"use client";

import { FormEvent, useState } from "react";
import { cleanEmail } from "@/lib/form-fields";
import { CONTACT_RECIPIENT_KEY, JOBS_RECIPIENT_KEY } from "@/lib/setting-keys";
import { createClient } from "@/lib/supabase/client";

export default function SiteSettingsForm({
  contactEmail,
  jobsEmail,
  stored,
  loadError,
}: {
  contactEmail: string;
  jobsEmail: string;
  stored: boolean;
  loadError: string | null;
}) {
  const supabase = createClient();
  const [contact, setContact] = useState(contactEmail);
  const [jobs, setJobs] = useState(jobsEmail);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    const nextContact = cleanEmail(contact);
    const nextJobs = cleanEmail(jobs);
    if (!nextContact || !nextJobs) {
      setError("Enter a valid email address for both inboxes.");
      return;
    }

    setSaving(true);
    const [contactResult, jobsResult] = await Promise.all([
      supabase
        .from("site_settings")
        .update({ value: nextContact })
        .eq("key", CONTACT_RECIPIENT_KEY)
        .select("key")
        .maybeSingle(),
      supabase
        .from("site_settings")
        .update({ value: nextJobs })
        .eq("key", JOBS_RECIPIENT_KEY)
        .select("key")
        .maybeSingle(),
    ]);
    setSaving(false);

    const saveError = contactResult.error ?? jobsResult.error;
    if (saveError) {
      setError(
        /site_settings|relation|schema cache/i.test(saveError.message)
          ? "The settings table is not in the database yet. In Supabase, open the SQL editor and run supabase/migrations/20261007_forms_and_settings.sql."
          : saveError.message
      );
      return;
    }

    if (!contactResult.data || !jobsResult.data) {
      setError(
        "Those inboxes are not saved yet. In Supabase, open the SQL editor and run supabase/migrations/20261007_forms_and_settings.sql."
      );
      return;
    }

    setSaved(true);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded border border-[#e0e0e0] bg-white p-4">
      <div>
        <h2 className="font-semibold">Where form emails go</h2>
        <p className="mt-1 text-sm text-[#666]">
          Change these addresses any time. Contact messages and new job postings are emailed here.
          No code change is required.
        </p>
      </div>

      {loadError ? (
        <p className="rounded border border-[#e0e0e0] bg-white p-3 text-sm text-red-600">
          Could not read email settings ({loadError}). Run{" "}
          <code>supabase/migrations/20261007_forms_and_settings.sql</code> in the Supabase SQL
          editor.
        </p>
      ) : null}

      {!loadError && !stored ? (
        <p className="rounded border border-[#e0e0e0] bg-white p-3 text-sm text-[#666]">
          These inboxes are not saved in the database yet. Run{" "}
          <code>supabase/migrations/20261007_forms_and_settings.sql</code> in the Supabase SQL
          editor, then come back and save.
        </p>
      ) : null}

      <div>
        <label htmlFor="contact-recipient" className="field-label">
          Contact form inbox
        </label>
        <input
          id="contact-recipient"
          type="email"
          required
          maxLength={320}
          value={contact}
          onChange={(event) => setContact(event.target.value)}
          className="field-input"
          disabled={Boolean(loadError) || !stored}
        />
      </div>
      <div>
        <label htmlFor="jobs-recipient" className="field-label">
          Job postings inbox
        </label>
        <input
          id="jobs-recipient"
          type="email"
          required
          maxLength={320}
          value={jobs}
          onChange={(event) => setJobs(event.target.value)}
          className="field-input"
          disabled={Boolean(loadError) || !stored}
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm text-[#2f6b3a]">Saved.</p> : null}

      <button
        type="submit"
        disabled={saving || Boolean(loadError) || !stored}
        className="field-button rounded bg-[#3f679b] px-4 py-2 text-[15px] font-medium text-white hover:bg-[#345580] disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save email addresses"}
      </button>
    </form>
  );
}
