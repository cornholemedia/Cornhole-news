"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import StaticPageView from "@/components/StaticPageView";
import { createClient } from "@/lib/supabase/client";
import {
  BODY_MAX,
  DEFAULT_PAGES,
  SUBTITLE_MAX,
  TITLE_MAX,
  type EditablePage,
  type StaticPageContent,
} from "@/lib/page-content";

export default function PageEditor({ page }: { page: EditablePage }) {
  const supabase = createClient();
  const router = useRouter();
  const [title, setTitle] = useState(page.title);
  const [subtitle, setSubtitle] = useState(page.subtitle);
  const [body, setBody] = useState(page.body);
  const [error, setError] = useState<string | null>(page.loadError);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fallback = DEFAULT_PAGES[page.slug];
  const preview: StaticPageContent = {
    slug: page.slug,
    title: title.trim() || fallback.title,
    subtitle,
    body: body.trim() ? body : fallback.body,
  };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    const nextTitle = title.trim();
    if (!nextTitle) {
      setError("Title is required.");
      return;
    }
    if (nextTitle.length > TITLE_MAX) {
      setError(`Title must be ${TITLE_MAX} characters or fewer.`);
      return;
    }
    if (subtitle.trim().length > SUBTITLE_MAX) {
      setError(`Subtitle must be ${SUBTITLE_MAX} characters or fewer.`);
      return;
    }
    if (body.length > BODY_MAX) {
      setError(`Body must be ${BODY_MAX} characters or fewer.`);
      return;
    }

    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push(`/login?next=/admin/pages/${page.slug}`);
      return;
    }

    const { error: saveError } = await supabase.from("pages").upsert(
      {
        slug: page.slug,
        title: nextTitle,
        subtitle: subtitle.trim(),
        body,
      },
      { onConflict: "slug" }
    );

    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm text-[#666]">
        <Link href="/admin" className="text-[#3f679b] hover:underline">
          ← All pages
        </Link>
      </p>
      <h1 className="mb-1 text-2xl font-bold">Edit /{page.slug}</h1>
      <p className="mb-4 text-sm text-[#666]">
        {page.stored
          ? "Saved in the database. The public page updates as soon as you save."
          : "This form starts from the built-in copy. Save it to store the page in Supabase."}
        {page.updatedAt
          ? ` Last updated ${new Date(page.updatedAt).toLocaleString()}.`
          : ""}
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="page-title" className="mb-1 block text-sm text-[#666]">
            Title
          </label>
          <input
            id="page-title"
            type="text"
            required
            maxLength={TITLE_MAX}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded border border-[#e0e0e0] bg-white px-3 py-2 text-[15px]"
          />
        </div>

        <div>
          <label htmlFor="page-subtitle" className="mb-1 block text-sm text-[#666]">
            Subtitle <span className="text-[#999]">(optional)</span>
          </label>
          <input
            id="page-subtitle"
            type="text"
            maxLength={SUBTITLE_MAX}
            value={subtitle}
            onChange={(event) => setSubtitle(event.target.value)}
            className="w-full rounded border border-[#e0e0e0] bg-white px-3 py-2 text-[15px]"
          />
        </div>

        <div>
          <label htmlFor="page-body" className="mb-1 block text-sm text-[#666]">
            Body
          </label>
          <textarea
            id="page-body"
            rows={14}
            maxLength={BODY_MAX}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="w-full rounded border border-[#e0e0e0] bg-white px-3 py-2 font-mono text-[13px] leading-relaxed"
          />
          <ul className="mt-2 space-y-1 text-[12px] text-[#666]">
            <li>Blank line starts a new paragraph.</li>
            <li>
              <code>## Heading</code> or <code>### Heading</code>
            </li>
            <li>
              <code>- list item</code>, <code>**bold**</code>,{" "}
              <code>[label](/path)</code> or <code>[label](https://example.com)</code>
            </li>
            <li>
              <code>note: muted line</code> for a smaller gray note.
            </li>
            <li>A blank body keeps the built-in copy on the public page.</li>
          </ul>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-[#2f6b3a]">Saved.</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-[#3f679b] px-4 py-2 text-[15px] font-medium text-white hover:bg-[#345580] disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <Link href={`/${page.slug}`} className="text-sm text-[#3f679b] hover:underline">
            View public page
          </Link>
        </div>
      </form>

      <div className="mt-8 border-t border-[#e0e0e0] pt-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#666]">
          Preview
        </h2>
        <StaticPageView page={preview} />
      </div>
    </div>
  );
}
