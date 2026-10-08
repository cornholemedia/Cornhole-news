"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  approveJobPosting,
  deleteJobPosting,
  extendJobPosting,
  rejectJobPosting,
  saveJobPosting,
  type AdminActionResult,
} from "@/app/admin/jobs/actions";
import {
  EMPLOYMENT_TYPES,
  JOB_DESCRIPTION_MAX,
  MIDWEST_STATES,
  PAY_PERIODS,
  WORK_TYPES,
  formatMidwestDate,
  midwestDateInput,
} from "@/lib/job-board";
import type { FormStatus } from "@/lib/form-fields";
import type { AdminJobPosting } from "@/lib/job-postings";

const initialState: FormStatus = { ok: false };

function statusText(job: AdminJobPosting): string {
  if (job.status === "pending") return "Pending review. It is not on the public jobs page.";
  if (job.status === "rejected") return "Rejected. It is hidden from the jobs page.";
  if (job.expiresAt && new Date(job.expiresAt).getTime() <= Date.now()) {
    return `Approved, but the listing ended on ${formatMidwestDate(job.expiresAt)}.`;
  }
  return `Approved. Open through ${formatMidwestDate(job.expiresAt)}.`;
}

export default function JobPostingEditor({ job }: { job: AdminJobPosting }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveJobPosting, initialState);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: (id: string) => Promise<AdminActionResult>, confirmMessage?: string) {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setBusy(true);
    setActionError(null);
    const result = await action(job.id);
    setBusy(false);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    if (confirmMessage) {
      router.push("/admin");
      router.refresh();
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm">
        <Link href="/admin" className="text-[#3f679b] hover:underline">
          Back to admin
        </Link>
      </p>
      <h1 className="mb-2 text-2xl font-bold">Edit job posting</h1>
      <p className="mb-4 text-[15px] leading-relaxed text-[#3a3a3a]">{statusText(job)}</p>
      <p className="mb-4 text-sm text-[#1a1a1a]">
        Poster: {job.posterName}, {job.posterEmail}. This contact is not shown on the public page.
        {!job.emailSent
          ? " No notice email was sent. The posting is still saved here."
          : " A notice email was sent to the jobs inbox."}
      </p>
      {job.listingFeeCents === 0 && job.paymentStatus === "not_required" ? (
        <p className="mb-4 text-sm text-[#3a3a3a]">Posting is free. A fee is not collected.</p>
      ) : (
        <p className="mb-4 text-sm text-[#3a3a3a]">
          Payment status: {job.paymentStatus}. Fee: ${(job.listingFeeCents / 100).toFixed(2)}.
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {job.status !== "approved" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(approveJobPosting)}
            className="field-button min-h-11 rounded bg-[#3f679b] px-3 text-sm font-medium text-white hover:bg-[#345580] disabled:opacity-60"
          >
            Approve
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(extendJobPosting)}
            className="field-button min-h-11 rounded bg-[#3f679b] px-3 text-sm font-medium text-white hover:bg-[#345580] disabled:opacity-60"
          >
            Extend 30 days
          </button>
        )}
        {job.status !== "rejected" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(rejectJobPosting)}
            className="field-button min-h-11 rounded border border-[#6b6b6b] bg-white px-3 text-sm font-medium text-[#1a1a1a] disabled:opacity-60"
          >
            Reject
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => run(deleteJobPosting, "Delete this job posting? This cannot be undone.")}
          className="field-button min-h-11 rounded border border-red-700 bg-white px-3 text-sm font-medium text-red-700 disabled:opacity-60"
        >
          Delete
        </button>
        {job.status === "approved" ? (
          <Link href={`/jobs/${job.id}`} className="inline-flex min-h-11 items-center text-sm text-[#3f679b] hover:underline">
            View public page
          </Link>
        ) : null}
      </div>
      {actionError ? (
        <p role="alert" className="mb-4 text-sm text-red-700">
          {actionError}
        </p>
      ) : null}

      <form action={formAction} className="space-y-3 rounded border border-[#e0e0e0] bg-white p-4">
        <input type="hidden" name="id" value={job.id} />
        <div>
          <label htmlFor="edit-title" className="field-label">
            Job title
          </label>
          <input
            id="edit-title"
            name="title"
            type="text"
            required
            maxLength={200}
            defaultValue={job.title}
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="edit-company" className="field-label">
            Company name
          </label>
          <input
            id="edit-company"
            name="companyName"
            type="text"
            required
            maxLength={200}
            defaultValue={job.companyName}
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="edit-website" className="field-label">
            Company website <span className="text-[#5c5c5c]">(optional)</span>
          </label>
          <input
            id="edit-website"
            name="companyWebsite"
            type="url"
            maxLength={500}
            defaultValue={job.companyWebsite ?? ""}
            className="field-input"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="edit-city" className="field-label">
              City
            </label>
            <input
              id="edit-city"
              name="city"
              type="text"
              required
              maxLength={80}
              defaultValue={job.city}
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="edit-state" className="field-label">
              State
            </label>
            <select id="edit-state" name="state" required defaultValue={job.state} className="field-input">
              {MIDWEST_STATES.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="edit-work" className="field-label">
              Work type
            </label>
            <select id="edit-work" name="workType" required defaultValue={job.workType} className="field-input">
              {WORK_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="edit-employment" className="field-label">
              Employment type
            </label>
            <select
              id="edit-employment"
              name="employmentType"
              required
              defaultValue={job.employmentType}
              className="field-input"
            >
              {EMPLOYMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <fieldset className="space-y-3">
          <legend className="field-label">Pay</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="edit-pay-min" className="field-label">
                Minimum
              </label>
              <input
                id="edit-pay-min"
                name="payMin"
                type="number"
                min="0"
                step="0.01"
                defaultValue={job.payMin ?? ""}
                className="field-input"
              />
            </div>
            <div>
              <label htmlFor="edit-pay-max" className="field-label">
                Maximum
              </label>
              <input
                id="edit-pay-max"
                name="payMax"
                type="number"
                min="0"
                step="0.01"
                defaultValue={job.payMax ?? ""}
                className="field-input"
              />
            </div>
            <div>
              <label htmlFor="edit-pay-period" className="field-label">
                Period
              </label>
              <select
                id="edit-pay-period"
                name="payPeriod"
                defaultValue={job.payPeriod ?? ""}
                className="field-input"
              >
                <option value="">Not listed</option>
                {PAY_PERIODS.map((period) => (
                  <option key={period.value} value={period.value}>
                    {period.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="edit-pay-note" className="field-label">
              Pay note
            </label>
            <input
              id="edit-pay-note"
              name="payNote"
              type="text"
              maxLength={300}
              defaultValue={job.payNote}
              className="field-input"
            />
          </div>
        </fieldset>
        <div>
          <label htmlFor="edit-description" className="field-label">
            Job description
          </label>
          <textarea
            id="edit-description"
            name="description"
            required
            rows={10}
            maxLength={JOB_DESCRIPTION_MAX}
            defaultValue={job.description}
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="edit-apply-url" className="field-label">
            Apply link
          </label>
          <input
            id="edit-apply-url"
            name="applyUrl"
            type="url"
            maxLength={500}
            defaultValue={job.applyUrl ?? ""}
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="edit-apply-email" className="field-label">
            Apply email
          </label>
          <input
            id="edit-apply-email"
            name="applyEmail"
            type="email"
            maxLength={320}
            defaultValue={job.applyEmail ?? ""}
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="edit-poster-name" className="field-label">
            Poster name <span className="text-[#5c5c5c]">(private)</span>
          </label>
          <input
            id="edit-poster-name"
            name="posterName"
            type="text"
            required
            maxLength={200}
            defaultValue={job.posterName}
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="edit-poster-email" className="field-label">
            Poster email <span className="text-[#5c5c5c]">(private)</span>
          </label>
          <input
            id="edit-poster-email"
            name="posterEmail"
            type="email"
            required
            maxLength={320}
            defaultValue={job.posterEmail}
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="edit-expires" className="field-label">
            Open through <span className="text-[#5c5c5c]">(Central Time)</span>
          </label>
          <input
            id="edit-expires"
            name="expiresOn"
            type="date"
            defaultValue={midwestDateInput(job.expiresAt)}
            className="field-input"
          />
          <p className="mt-1 text-[12px] text-[#3a3a3a]">
            Leave this blank on a pending job and approval keeps it up for 30 days.
          </p>
        </div>

        {state.ok ? (
          <p role="status" className="text-sm text-[#2f6b3a]">
            {state.message ?? "Saved."}
          </p>
        ) : state.error ? (
          <p role="alert" className="rounded border border-red-700 bg-white p-3 text-sm text-red-700">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending || busy}
          className="field-button min-h-11 rounded bg-[#3f679b] px-4 py-2 text-[15px] font-medium text-white hover:bg-[#345580] disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
}
