"use client";

import { useState } from "react";
import { saveAnnouncement } from "@/app/admin/announcement/actions";
import { ANNOUNCEMENT_MAX, type AnnouncementDraft } from "@/lib/announcement";

export default function AnnouncementForm({ initial }: { initial: AnnouncementDraft }) {
  const [body, setBody] = useState(initial.body);
  const [linkUrl, setLinkUrl] = useState(initial.linkUrl ?? "");
  const [active, setActive] = useState(initial.active);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const result = await saveAnnouncement({ body, linkUrl, active });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded border border-[#e0e0e0] bg-white p-4">
      <div>
        <label htmlFor="announcement-body" className="field-label">
          Banner text
        </label>
        <textarea
          id="announcement-body"
          value={body}
          rows={3}
          maxLength={ANNOUNCEMENT_MAX}
          onChange={(event) => setBody(event.target.value)}
          className="field-input"
        />
        <p className="mt-1 text-xs text-[#666]">
          {body.trim().length}/{ANNOUNCEMENT_MAX}
        </p>
      </div>
      <div>
        <label htmlFor="announcement-link" className="field-label">
          Link <span className="font-normal text-[#666]">(optional)</span>
        </label>
        <input
          id="announcement-link"
          type="text"
          value={linkUrl}
          onChange={(event) => setLinkUrl(event.target.value)}
          placeholder="https:// or /page"
          className="field-input"
        />
      </div>
      <label htmlFor="announcement-active" className="flex min-h-11 items-center gap-2 text-sm">
        <input
          id="announcement-active"
          type="checkbox"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
          className="h-4 w-4 accent-[#3f679b]"
        />
        Show on the site
      </label>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-[#2f6b3a]">
          Saved. The banner updates on the next page load.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="field-button min-h-11 rounded bg-[#3f679b] px-3 text-sm font-medium text-white hover:bg-[#345580] disabled:opacity-60"
      >
        {busy ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
