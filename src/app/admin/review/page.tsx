import type { Metadata } from "next";
import Link from "next/link";
import DigestReview from "@/components/DigestReview";
import { DIGEST_BOT_SETUP, DIGEST_POLITICS_HINT } from "@/lib/digest";
import { getDigestReview } from "@/lib/digest-review";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Review digest",
  description: "Review the daily Midwest digest before those stories go on the site.",
  path: "/admin/review",
  noIndex: true,
});

export default async function AdminDigestReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const review = await getDigestReview(date);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold">Review digest</h1>
      <p className="mb-3 text-[15px] leading-relaxed text-[#666]">
        Stories from the daily Midwest digest wait here. Nothing is posted until you
        publish it. Politics tags that one post, and stays off unless you turn it on.
        Delete removes a story from this date. Delete all removes every story still
        waiting for the date you are viewing. A later send of a deleted link will
        not put it back.
      </p>
      <p className="mb-6 text-sm">
        <Link href="/admin" className="text-[#3f679b] hover:underline">
          Back to admin
        </Link>
      </p>

      {review.loadError ? (
        <p role="alert" className="rounded border border-[#e0e0e0] bg-white p-4 text-sm text-red-700">
          {review.loadError}
        </p>
      ) : null}

      {!review.loadError && !review.botReady ? (
        <p role="status" className="mb-6 rounded border border-[#e0e0e0] bg-white p-4 text-sm text-[#1a1a1a]">
          {DIGEST_BOT_SETUP}
        </p>
      ) : null}

      {!review.loadError && review.botIsAdmin ? (
        <p role="status" className="mb-6 rounded border border-[#e0e0e0] bg-white p-4 text-sm text-[#1a1a1a]">
          Cornhole News is marked as an admin. It only needs to author digest posts. In
          the SQL editor, run: update public.profiles set is_admin = false where username
          = &apos;Cornhole News&apos;;
        </p>
      ) : null}

      {!review.loadError && review.dates.length === 0 ? (
        <p className="rounded border border-[#e0e0e0] bg-white p-4 text-sm text-[#3a3a3a]">
          No digest has arrived yet. Stories show up here after the daily job sends them.
          They stay hidden until you publish.
        </p>
      ) : null}

      {!review.loadError && review.dates.length > 0 ? (
        <form action="/admin/review" method="get" className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="sm:min-w-80">
            <label htmlFor="digest-date" className="field-label">
              Digest date
            </label>
            <select
              id="digest-date"
              name="date"
              defaultValue={review.selectedDate ?? undefined}
              className="field-input"
            >
              {review.dates.map((option) => (
                <option key={option.date} value={option.date}>
                  {option.label} ({option.pendingCount} waiting)
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="field-button min-h-11 rounded border border-[#3f679b] bg-white px-3 text-sm font-medium text-[#3f679b]"
          >
            Show this date
          </button>
        </form>
      ) : null}

      {!review.loadError && review.selectedDate && !review.politicsReady ? (
        <p role="status" className="mb-6 rounded border border-[#e0e0e0] bg-white p-4 text-sm text-[#1a1a1a]">
          {DIGEST_POLITICS_HINT}
        </p>
      ) : null}

      {!review.loadError && review.selectedDate && review.selectedLabel ? (
        <DigestReview
          digestDate={review.selectedDate}
          dateLabel={review.selectedLabel}
          groups={review.groups}
          pendingCount={review.pendingCount}
          moreWaiting={review.moreWaiting}
          politicsReady={review.politicsReady}
          botReady={review.botReady}
        />
      ) : null}
    </div>
  );
}
