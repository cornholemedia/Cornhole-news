"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  deleteDigestStory,
  publishDigestStory,
  type DigestActionResult,
} from "@/app/admin/review/actions";

type ReviewStory = {
  id: string;
  headline: string;
  url: string;
  body: string;
  status: "pending" | "published";
  postId: number | null;
};

type ReviewGroup = {
  section: string;
  stories: ReviewStory[];
};

type PendingAction = {
  id: string;
  action: "publish" | "delete";
};

export default function DigestReview({
  dateLabel,
  groups,
  pendingCount,
  moreWaiting,
  botReady,
}: {
  dateLabel: string;
  groups: ReviewGroup[];
  pendingCount: number;
  moreWaiting: number;
  botReady: boolean;
}) {
  const router = useRouter();
  const busyRef = useRef(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [postId, setPostId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const busy = pending !== null;

  return (
    <section aria-labelledby="digest-review-heading">
      <div className="rounded border border-[#e0e0e0] bg-white p-4">
        <h2 id="digest-review-heading" className="font-semibold">
          {dateLabel}
        </h2>
        <p className="mt-1 text-sm text-[#3a3a3a]">
          {pendingCount === 0
            ? "Nothing is waiting for this date. Published stories stay listed here."
            : `${pendingCount} ${pendingCount === 1 ? "story is" : "stories are"} still hidden. Publish posts that one story as Cornhole News. Politics stays off.`}
          {moreWaiting > 0 ? (
            <span className="mt-1 block">
              {moreWaiting} more {moreWaiting === 1 ? "is" : "are"} waiting beyond this list.
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
                    {story.status === "pending" ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy || !botReady}
                          onClick={() => run(story.id, "publish", () => publishDigestStory(story.id))}
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
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-[#3a3a3a]">
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
