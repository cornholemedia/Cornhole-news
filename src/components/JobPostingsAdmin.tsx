"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  approveJobPosting,
  deleteJobPosting,
  extendJobPosting,
  rejectJobPosting,
  type AdminActionResult,
} from "@/app/admin/jobs/actions";
import {
  employmentTypeLabel,
  formatMidwestDate,
  formatMidwestWhen,
  midwestStateName,
  paySummary,
  workTypeLabel,
} from "@/lib/job-board";
import type { AdminJobPosting } from "@/lib/job-postings";

function statusText(job: AdminJobPosting): string {
  if (job.status === "pending") return "Pending review";
  if (job.status === "rejected") return "Rejected";
  if (job.expiresAt && new Date(job.expiresAt).getTime() <= Date.now()) {
    return "Approved, listing ended";
  }
  return "Approved";
}

export default function JobPostingsAdmin({
  postings,
  pendingCount,
  loadError,
}: {
  postings: AdminJobPosting[];
  pendingCount: number;
  loadError: string | null;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(
    id: string,
    action: (id: string) => Promise<AdminActionResult>,
    success: string,
    confirmMessage?: string
  ) {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setPendingId(id);
    setError(null);
    setMessage(null);
    const result = await action(id);
    setPendingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(success);
    router.refresh();
  }

  return (
    <section className="rounded border border-[#e0e0e0] bg-white p-4" aria-labelledby="job-admin-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="job-admin-heading" className="font-semibold">
            Job postings
          </h2>
          <p className="mt-1 text-sm text-[#3a3a3a]">
            Review jobs employers submitted for the Midwest board. Posting is free.
            {pendingCount > 0
              ? ` ${pendingCount} ${pendingCount === 1 ? "job is" : "jobs are"} waiting for review.`
              : ""}
          </p>
        </div>
        <Link href="/jobs" className="text-sm text-[#3f679b] hover:underline">
          View the jobs page
        </Link>
      </div>

      {loadError ? (
        <p className="mt-4 rounded border border-[#e0e0e0] bg-[#f6f6ef] p-3 text-sm text-red-700">
          {loadError}
        </p>
      ) : null}

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

      {!loadError && postings.length === 0 ? (
        <p className="mt-4 text-sm text-[#3a3a3a]">
          No one has posted a job yet. New submissions show up here for review.
        </p>
      ) : null}

      {postings.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {postings.map((job) => {
            const busy = pendingId === job.id;
            return (
              <li key={job.id} className="rounded border border-[#e0e0e0] p-3">
                <div className="flex flex-col gap-1">
                  <h3 className="font-semibold text-[#1a1a1a]">{job.title}</h3>
                  <p className="text-sm text-[#1a1a1a]">
                    {job.companyName} · {job.city}, {midwestStateName(job.state)}
                  </p>
                  <p className="text-sm text-[#3a3a3a]">
                    {statusText(job)} · {workTypeLabel(job.workType)} ·{" "}
                    {employmentTypeLabel(job.employmentType)}
                  </p>
                  <p className="text-sm text-[#1a1a1a]">{paySummary(job)}</p>
                  <p className="text-sm text-[#3a3a3a]">
                    Submitted {formatMidwestWhen(job.createdAt)}
                    {job.expiresAt ? ` · Open through ${formatMidwestDate(job.expiresAt)}` : ""}
                  </p>
                  <p className="text-sm text-[#1a1a1a]">
                    Poster: {job.posterName}{" "}
                    <a
                      href={`mailto:${encodeURIComponent(job.posterEmail)}`}
                      className="text-[#3f679b] hover:underline"
                    >
                      {job.posterEmail}
                    </a>
                  </p>
                  {!job.emailSent ? (
                    <p className="text-sm text-[#3a3a3a]">
                      No notice email was sent. The posting is still saved here.
                    </p>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {job.status !== "approved" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(job.id, approveJobPosting, "Approved. It is now on the jobs page.")}
                      className="field-button min-h-11 rounded bg-[#3f679b] px-3 text-sm font-medium text-white hover:bg-[#345580] disabled:opacity-60"
                    >
                      Approve
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(job.id, extendJobPosting, "Extended by 30 days.")}
                      className="field-button min-h-11 rounded bg-[#3f679b] px-3 text-sm font-medium text-white hover:bg-[#345580] disabled:opacity-60"
                    >
                      Extend 30 days
                    </button>
                  )}
                  {job.status !== "rejected" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(job.id, rejectJobPosting, "Rejected. It is hidden from the jobs page.")}
                      className="field-button min-h-11 rounded border border-[#6b6b6b] bg-white px-3 text-sm font-medium text-[#1a1a1a] disabled:opacity-60"
                    >
                      Reject
                    </button>
                  ) : null}
                  <Link
                    href={`/admin/jobs/${job.id}`}
                    className="field-button inline-flex min-h-11 items-center rounded border border-[#3f679b] bg-white px-3 text-sm font-medium text-[#3f679b] hover:underline"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(
                        job.id,
                        deleteJobPosting,
                        "Deleted.",
                        "Delete this job posting? This cannot be undone."
                      )
                    }
                    className="field-button min-h-11 rounded border border-red-700 bg-white px-3 text-sm font-medium text-red-700 disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
