"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteDigestStory, publishDigestDate, type DigestActionResult } from "@/app/admin/review/actions";

type ReviewStory = {
  id: string;
  headline: string;
  url: string;
  body: string;
};

type ReviewGroup = {
  section: string;
  stories: ReviewStory[];
};

export default function DigestReview({
  digestDate,
  dateLabel,
  groups,
  pendingCount,
  moreWaiting,
  botReady,
}: {
  digestDate: string;
  dateLabel: string;
  groups: ReviewGroup[];
  pendingCount: number;
  moreWaiting: number;
  botReady: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(
    id: string,
    action: () => Promise<DigestActionResult>,
    confirmMessage?: string
  ) {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setPendingId(id);
    setError(null);
    setMessage(null);
    const result = await action();
    setPendingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(result.message);
    router.refresh();
  }

  const busy = pendingId !== null;

  return (
    <section aria-labelledby="digest-review-heading">
      <div className="rounded border border-[#e0e0e0] bg-white p-4">
        <h2 id="digest-review-heading" className="font-semibold">
          Waiting for {dateLabel}
        </h2>
        <p className="mt-1 text-sm text-[#3a3a3a]">
          {pendingCount === 0
            ? "Nothing is waiting for this date. Published stories are already on the site. Deleted stories stay hidden."
            : `${pendingCount} ${pendingCount === 1 ? "story is" : "stories are"} still hidden. Publish all adds every story still waiting for this date. Each post is by Cornhole News, and politics stays off.`}
        {moreWaiting > 0 ? (
          <span className="mt-1 block">
            {moreWaiting} more {moreWaiting === 1 ? "is" : "are"} waiting beyond this list. Publish
            all handles 500 at a time.
          </span>
        ) : null}
        </p>

        {message ? (
          <p role="status" className="mt-4 text-sm text-[#2f6b3a]">
            {message}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {pendingCount > 0 ? (
          <button
            type="button"
            disabled={busy || !botReady}
            onClick={() =>
              run(
                "publish",
                () => publishDigestDate(digestDate),
                `Publish ${pendingCount} ${pendingCount === 1 ? "story" : "stories"} from ${dateLabel}? They will show on the site as Cornhole News.`
              )
            }
            className="field-button mt-4 min-h-11 rounded bg-[#3f679b] px-3 text-sm font-medium text-white hover:bg-[#345580] disabled:opacity-60"
          >
            {pendingId === "publish" ? "Publishing..." : "Publish all"}
          </button>
        ) : null}
      </div>

      {groups.map((group) => {
        const sectionId = `section-${group.section.replace(/\s+/g, "-").toLowerCase()}`;
        return (
        <section key={group.section} className="mt-6" aria-labelledby={sectionId}>
          <h2
            id={sectionId}
            className="text-sm font-semibold tracking-wide text-[#1a1a1a]"
          >
            {group.section}
          </h2>
          <ul className="mt-2 space-y-3">
            {group.stories.map((story) => {
              const storyBusy = pendingId === story.id;
              return (
                <li key={story.id} className="rounded border border-[#e0e0e0] bg-white p-3">
                  <h3 className="font-semibold wrap-break-word text-[#1a1a1a]">
                    <a
                      href={story.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#3f679b] hover:underline"
                    >
                      {story.headline}
                    </a>
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed wrap-break-word text-[#1a1a1a]">{story.body}</p>
                  <div className="mt-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(
                          story.id,
                          () => deleteDigestStory(story.id),
                          "Delete this story? It stays off the site, and a later digest will not bring this URL back for this date."
                        )
                      }
                      className="field-button min-h-11 rounded border border-red-700 bg-white px-3 text-sm font-medium text-red-700 disabled:opacity-60"
                    >
                      {storyBusy ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
        );
      })}
    </section>
  );
}
