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

type ReviewStory = {
  id: string;
  headline: string;
  url: string;
  body: string;
  status: "pending" | "published";
  postId: number | null;
  isPolitical: boolean;
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
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="sm:min-w-80">
          <label htmlFor="digest-date" className="field-label">
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
            className="field-input"
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
          className="field-button min-h-11 rounded border border-red-700 bg-white px-3 text-sm font-medium text-red-700 disabled:opacity-60"
        >
          {finishing ? "Finishing..." : "Finished"}
        </button>
      </div>

      <div className="rounded border border-[#e0e0e0] bg-white p-4">
        <h2 id="digest-review-heading" className="font-semibold">
          {dateLabel}
        </h2>
        <p className="mt-1 text-sm text-[#3a3a3a]">
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
          <p role="status" className="mt-4 text-sm text-[#2f6b3a]">
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
          <p role="alert" className="mt-4 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </div>

      {groups.map((group) => {
        const sectionId = `section-${group.section.replace(/\s+/g, "-").toLowerCase()}`;
        return (
          <section key={group.section} className="mt-6" aria-labelledby={sectionId}>
            <h2 id={sectionId} className="text-sm font-semibold tracking-wide text-[#1a1a1a]">
              {group.section}
            </h2>
            <ul className="mt-2 space-y-3">
              {group.stories.map((story) => {
                const publishing = pending?.id === story.id && pending.action === "publish";
                const deleting = pending?.id === story.id && pending.action === "delete";
                const checked = flags[story.id] ?? story.isPolitical;
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
                    <p className="mt-2 text-sm leading-relaxed wrap-break-word text-[#1a1a1a]">
                      {story.body}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <label
                        htmlFor={`politics-${story.id}`}
                        className="flex min-h-11 items-center gap-2 text-sm text-[#1a1a1a]"
                      >
                        <input
                          id={`politics-${story.id}`}
                          type="checkbox"
                          checked={checked}
                          disabled={busy || !politicsReady}
                          onChange={(event) => onPolitics(story.id, event.target.checked)}
                          className="h-4 w-4 accent-[#3f679b]"
                        />
                        Politics
                      </label>
                      {story.status === "pending" ? (
                        <>
                          <button
                            type="button"
                            disabled={busy || !botReady}
                            onClick={() =>
                              run(story.id, "publish", () => publishDigestStory(story.id))
                            }
                            className="field-button min-h-11 rounded bg-[#3f679b] px-3 text-sm font-medium text-white hover:bg-[#345580] disabled:opacity-60"
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
                            className="field-button min-h-11 rounded border border-red-700 bg-white px-3 text-sm font-medium text-red-700 disabled:opacity-60"
                          >
                            {deleting ? "Deleting..." : "Delete"}
                          </button>
                        </>
                      ) : (
                        <p className="text-sm text-[#3a3a3a]">
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
