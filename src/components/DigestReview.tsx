"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  deleteDigestStory,
  deletePendingDigestStories,
  publishDigestStory,
  setDigestStoryPolitics,
  type DigestActionResult,
} from "@/app/admin/review/actions";
import TweetDraftField from "@/components/TweetDraftField";
import { reviewStoryCollapsed } from "@/lib/review-card";

type ReviewStory = {
  id: string;
  headline: string;
  url: string;
  body: string;
  status: "pending" | "published";
  postId: number | null;
  isPolitical: boolean;
  tweetText: string;
};

type ReviewGroup = {
  section: string;
  stories: ReviewStory[];
};

type DateChoice = {
  date: string;
  label: string;
  pendingCount: number;
};

type PendingAction = {
  id: string;
  action: "publish" | "delete" | "finish" | "politics";
};

export default function DigestReview({
  dates,
  digestDate,
  dateLabel,
  groups,
  pendingCount,
  moreWaiting,
  politicsReady,
  botReady,
}: {
  dates: DateChoice[];
  digestDate: string;
  dateLabel: string;
  groups: ReviewGroup[];
  pendingCount: number;
  moreWaiting: number;
  politicsReady: boolean;
  botReady: boolean;
}) {
  const router = useRouter();
  const busyRef = useRef(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [flagSource, setFlagSource] = useState(groups);
  const [message, setMessage] = useState<string | null>(null);
  const [postId, setPostId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [publishedNow, setPublishedNow] = useState<Record<string, true>>({});

  if (flagSource !== groups) {
    setFlagSource(groups);
    setFlags((current) => {
      const known = new Map(
        groups.flatMap((group) => group.stories.map((story) => [story.id, story.isPolitical] as const))
      );
      let changed = false;
      const next = { ...current };
      for (const [id, value] of Object.entries(current)) {
        if (known.get(id) === value) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }

  async function run(
    id: string,
    actionName: PendingAction["action"],
    action: () => Promise<DigestActionResult>,
    confirmMessage?: string
  ) {
    if (busyRef.current) return;
    busyRef.current = true;
    if (confirmMessage && !window.confirm(confirmMessage)) {
      busyRef.current = false;
      return;
    }

    setPending({ id, action: actionName });
    setError(null);
    setMessage(null);
    setPostId(null);
    try {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message);
      setPostId(result.postId ?? null);
      if (actionName === "publish") {
        setPublishedNow((current) => ({ ...current, [id]: true }));
        setExpanded((current) => ({ ...current, [id]: false }));
      }
      router.refresh();
    } catch {
      setError("That could not be saved.");
    } finally {
      busyRef.current = false;
      setPending(null);
    }
  }

  async function onPolitics(storyId: string, next: boolean) {
    if (busyRef.current || !politicsReady) return;
    busyRef.current = true;
    setFlags((current) => ({ ...current, [storyId]: next }));
    setPending({ id: storyId, action: "politics" });
    setError(null);
    setMessage(null);
    setPostId(null);
    try {
      const result = await setDigestStoryPolitics(storyId, next);
      if (!result.ok) {
        setFlags((current) => {
          const copy = { ...current };
          delete copy[storyId];
          return copy;
        });
        setError(result.error);
        return;
      }
      setMessage(result.message);
      setPostId(result.postId ?? null);
      router.refresh();
    } catch {
      setFlags((current) => {
        const copy = { ...current };
        delete copy[storyId];
        return copy;
      });
      setError("That could not be saved.");
    } finally {
      busyRef.current = false;
      setPending(null);
    }
  }

  const busy = pending !== null;
  const waiting = pendingCount + moreWaiting;
  const finishing = pending?.action === "finish";

  return (
    <section aria-labelledby="digest-review-heading">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:min-w-80 sm:flex-1">
          <label htmlFor="digest-date" className="field-label text-base">
            Digest date
          </label>
          <select
            id="digest-date"
            value={digestDate}
            disabled={busy}
            onChange={(event) => {
              const next = event.target.value;
              if (next && next !== digestDate) router.push(`/admin/review?date=${next}`);
            }}
            className="field-input min-h-12 text-base"
          >
            {dates.map((option) => (
              <option key={option.date} value={option.date}>
                {option.label} ({option.pendingCount} waiting)
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={busy}
          aria-label={`Mark ${dateLabel} finished`}
          onClick={() =>
            run(
              digestDate,
              "finish",
              () => deletePendingDigestStories(digestDate),
              `Mark ${dateLabel} finished? Every story still waiting for this date will be deleted. Published stories stay on the site. A later digest will not bring these links back for this date.`
            )
          }
          className="field-button min-h-12 w-full rounded border border-red-700 bg-white px-4 text-base font-medium text-red-700 disabled:opacity-60 sm:w-auto"
        >
          {finishing ? "Finishing..." : "Finished"}
        </button>
      </div>

      <div className="rounded border border-[#e0e0e0] bg-white p-4 sm:p-5">
        <h2 id="digest-review-heading" className="text-lg font-semibold leading-snug">
          {dateLabel}
        </h2>
        <p className="mt-2 text-base leading-relaxed text-[#1a1a1a]">
          {waiting === 0
            ? "Nothing is waiting for this date. Published stories stay listed here."
            : `${waiting} ${waiting === 1 ? "story is" : "stories are"} still hidden. Publish posts that one story as Cornhole News. Politics is off until you turn it on.`}
          {moreWaiting > 0 ? (
            <span className="mt-1 block">
              {moreWaiting} of those {moreWaiting === 1 ? "is" : "are"} beyond this list. Finished still includes them.
            </span>
          ) : null}
        </p>

        {message ? (
          <p role="status" className="mt-4 text-base text-[#2f6b3a]">
            {message}
            {postId ? (
              <>
                {" "}
                <Link href={`/item/${postId}`} className="text-[#3f679b] hover:underline">
                  View post
                </Link>
              </>
            ) : null}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-4 text-base text-red-700">
            {error}
          </p>
        ) : null}
      </div>

      {groups.map((group) => {
        const sectionId = `section-${group.section.replace(/\s+/g, "-").toLowerCase()}`;
        return (
          <section key={group.section} className="mt-8" aria-labelledby={sectionId}>
            <h2 id={sectionId} className="text-base font-semibold tracking-wide text-[#1a1a1a]">
              {group.section}
            </h2>
            <ul className="mt-3 space-y-3">
              {group.stories.map((story) => {
                const publishing = pending?.id === story.id && pending.action === "publish";
                const deleting = pending?.id === story.id && pending.action === "delete";
                const checked = flags[story.id] ?? story.isPolitical;
                const status = publishedNow[story.id] ? "published" : story.status;
                const collapsed = reviewStoryCollapsed(status, expanded[story.id] === true);
                if (collapsed) {
                  return (
                    <li key={story.id} className="rounded border border-[#e0e0e0] bg-white p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                        <h3 className="min-w-0 text-base font-semibold leading-snug wrap-break-word text-[#1a1a1a] sm:flex-1">
                          <a
                            href={story.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#3f679b] hover:underline"
                          >
                            {story.headline}
                          </a>
                        </h3>
                        <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                          <span className="text-sm font-medium text-[#3a3a3a]">Published</span>
                          <button
                            type="button"
                            aria-expanded={false}
                            aria-label={`Expand ${story.headline}`}
                            onClick={() => setExpanded((current) => ({ ...current, [story.id]: true }))}
                            className="field-button min-h-11 shrink-0 rounded border border-[#c8c8c8] bg-white px-4 text-base font-medium text-[#1a1a1a]"
                          >
                            Expand
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                }
                return (
                  <li key={story.id} className="rounded border border-[#e0e0e0] bg-white p-4">
                    {status === "published" ? (
                      <div className="mb-3 flex sm:justify-end">
                        <button
                          type="button"
                          aria-expanded={true}
                          aria-label={`Collapse ${story.headline}`}
                          onClick={() => setExpanded((current) => ({ ...current, [story.id]: false }))}
                          className="field-button min-h-11 w-full rounded border border-[#c8c8c8] bg-white px-4 text-base font-medium text-[#1a1a1a] sm:w-auto"
                        >
                          Collapse
                        </button>
                      </div>
                    ) : null}
                    <h3 className="text-base font-semibold leading-snug wrap-break-word text-[#1a1a1a]">
                      <a
                        href={story.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#3f679b] hover:underline"
                      >
                        {story.headline}
                      </a>
                    </h3>
                    <p className="mt-2 text-base leading-relaxed wrap-break-word text-[#1a1a1a]">
                      {story.body}
                    </p>
                    <TweetDraftField storyId={story.id} initialText={story.tweetText} />
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                      <label
                        htmlFor={`politics-${story.id}`}
                        className="flex min-h-11 items-center gap-2 text-base text-[#1a1a1a]"
                      >
                        <input
                          id={`politics-${story.id}`}
                          type="checkbox"
                          checked={checked}
                          disabled={busy || !politicsReady}
                          onChange={(event) => onPolitics(story.id, event.target.checked)}
                          className="h-5 w-5 accent-[#3f679b]"
                        />
                        Politics
                      </label>
                      {status === "pending" ? (
                        <>
                          <button
                            type="button"
                            disabled={busy || !botReady}
                            onClick={() =>
                              run(story.id, "publish", () => publishDigestStory(story.id))
                            }
                            className="field-button min-h-11 w-full rounded bg-[#3f679b] px-4 text-base font-medium text-white hover:bg-[#345580] disabled:opacity-60 sm:w-auto"
                          >
                            {publishing ? "Publishing..." : "Publish"}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(
                                story.id,
                                "delete",
                                () => deleteDigestStory(story.id),
                                "Delete this story? It stays off the site, and a later digest will not bring this URL back for this date."
                              )
                            }
                            className="field-button min-h-11 w-full rounded border border-red-700 bg-white px-4 text-base font-medium text-red-700 disabled:opacity-60 sm:w-auto"
                          >
                            {deleting ? "Deleting..." : "Delete"}
                          </button>
                        </>
                      ) : (
                        <p className="text-base text-[#1a1a1a]">
                          Published.
                          {story.postId ? (
                            <>
                              {" "}
                              <Link
                                href={`/item/${story.postId}`}
                                className="text-[#3f679b] hover:underline"
                              >
                                View post
                              </Link>
                            </>
                          ) : null}
                        </p>
                      )}
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
