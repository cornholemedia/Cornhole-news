"use client";

import Link from "next/link";
import { useActionState } from "react";
import HoneypotField from "@/components/HoneypotField";
import { submitJobPosting } from "@/app/jobs/actions";
import {
  EMPLOYMENT_TYPES,
  JOB_DESCRIPTION_MAX,
  JOB_DESCRIPTION_MIN,
  MIDWEST_STATES,
  PAY_PERIODS,
  WORK_TYPES,
} from "@/lib/job-board";
import type { FormStatus } from "@/lib/form-fields";

const initialState: FormStatus = { ok: false };

export default function JobPostForm() {
  const [state, formAction, pending] = useActionState(submitJobPosting, initialState);

  if (state.ok) {
    return (
      <div
        role="status"
        className="rounded border border-[#2f6b3a] bg-white p-4 text-[15px] leading-relaxed text-[#1a1a1a]"
      >
        <p>Thanks. We received this job and will review it before it appears on the jobs page.</p>
        <p className="mt-2">Posting is free.</p>
        <p className="mt-4">
          <Link href="/jobs" className="text-[#3f679b] underline">
            Back to jobs
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="relative space-y-3">
      <HoneypotField />
      <div>
        <label htmlFor="job-title" className="field-label">
          Job title
        </label>
        <input id="job-title" name="title" type="text" required maxLength={200} className="field-input" />
      </div>
      <div>
        <label htmlFor="job-company" className="field-label">
          Company name
        </label>
        <input
          id="job-company"
          name="companyName"
          type="text"
          required
          maxLength={200}
          autoComplete="organization"
          className="field-input"
        />
      </div>
      <div>
        <label htmlFor="job-website" className="field-label">
          Company website <span className="text-[#5c5c5c]">(optional)</span>
        </label>
        <input
          id="job-website"
          name="companyWebsite"
          type="url"
          maxLength={500}
          placeholder="https://"
          autoComplete="url"
          className="field-input"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="job-city" className="field-label">
            City
          </label>
          <input
            id="job-city"
            name="city"
            type="text"
            required
            maxLength={80}
            autoComplete="address-level2"
            aria-describedby="job-city-hint"
            className="field-input"
          />
          <p id="job-city-hint" className="mt-1 text-[12px] text-[#3a3a3a]">
            Use the city where the job is based, including for remote work.
          </p>
        </div>
        <div>
          <label htmlFor="job-state" className="field-label">
            State
          </label>
          <select
            id="job-state"
            name="state"
            required
            defaultValue=""
            autoComplete="address-level1"
            className="field-input"
          >
            <option value="" disabled>
              Select a state
            </option>
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
          <label htmlFor="job-work-type" className="field-label">
            Work type
          </label>
          <select id="job-work-type" name="workType" required defaultValue="" className="field-input">
            <option value="" disabled>
              Select one
            </option>
            {WORK_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="job-employment-type" className="field-label">
            Employment type
          </label>
          <select
            id="job-employment-type"
            name="employmentType"
            required
            defaultValue=""
            className="field-input"
          >
            <option value="" disabled>
              Select one
            </option>
            {EMPLOYMENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="field-label">
          Pay <span className="text-[#5c5c5c]">(optional)</span>
        </legend>
        <p className="text-[12px] text-[#3a3a3a]">
          Enter a minimum, a maximum, or both, and how often that pay is. A short note is optional.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="job-pay-min" className="field-label">
              Minimum
            </label>
            <input
              id="job-pay-min"
              name="payMin"
              type="number"
              min="0"
              max="99999999.99"
              step="0.01"
              inputMode="decimal"
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="job-pay-max" className="field-label">
              Maximum
            </label>
            <input
              id="job-pay-max"
              name="payMax"
              type="number"
              min="0"
              max="99999999.99"
              step="0.01"
              inputMode="decimal"
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="job-pay-period" className="field-label">
              Period
            </label>
            <select id="job-pay-period" name="payPeriod" defaultValue="" className="field-input">
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
          <label htmlFor="job-pay-note" className="field-label">
            Pay note <span className="text-[#5c5c5c]">(optional)</span>
          </label>
          <input
            id="job-pay-note"
            name="payNote"
            type="text"
            maxLength={300}
            className="field-input"
          />
        </div>
      </fieldset>

      <div>
        <label htmlFor="job-description" className="field-label">
          Job description
        </label>
        <textarea
          id="job-description"
          name="description"
          required
          rows={10}
          minLength={JOB_DESCRIPTION_MIN}
          maxLength={JOB_DESCRIPTION_MAX}
          aria-describedby="job-description-hint"
          className="field-input"
        />
        <p id="job-description-hint" className="mt-1 text-[12px] text-[#3a3a3a]">
          At least {JOB_DESCRIPTION_MIN} characters. Include the work, the schedule, and what you need.
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className="field-label">How to apply</legend>
        <p className="text-[12px] text-[#3a3a3a]">Enter a link, an email, or both.</p>
        <div>
          <label htmlFor="job-apply-url" className="field-label">
            Apply link
          </label>
          <input
            id="job-apply-url"
            name="applyUrl"
            type="url"
            maxLength={500}
            placeholder="https://"
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="job-apply-email" className="field-label">
            Apply email
          </label>
          <input
            id="job-apply-email"
            name="applyEmail"
            type="email"
            maxLength={320}
            autoComplete="off"
            className="field-input"
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="field-label">Your contact information</legend>
        <p id="job-poster-hint" className="text-[12px] text-[#3a3a3a]">
          Only an admin can see this. It is not published on the job page. See the{" "}
          <Link href="/privacy" className="text-[#3f679b] underline">
            Privacy Policy
          </Link>
          .
        </p>
        <div>
          <label htmlFor="job-poster-name" className="field-label">
            Your name
          </label>
          <input
            id="job-poster-name"
            name="posterName"
            type="text"
            required
            maxLength={200}
            autoComplete="name"
            aria-describedby="job-poster-hint"
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="job-poster-email" className="field-label">
            Your email
          </label>
          <input
            id="job-poster-email"
            name="posterEmail"
            type="email"
            required
            maxLength={320}
            autoComplete="email"
            className="field-input"
          />
        </div>
      </fieldset>

      <label className="flex items-start gap-2 text-sm leading-relaxed text-[#1a1a1a]">
        <input name="terms" type="checkbox" required className="mt-1 h-4 w-4 accent-[#3f679b]" />
        <span>
          I agree to the{" "}
          <Link href="/terms" className="text-[#3f679b] underline">
            Terms of Use
          </Link>{" "}
          and confirm this job is real and located in the Midwest.
        </span>
      </label>

      {state.error ? (
        <p role="alert" className="rounded border border-red-700 bg-white p-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="field-button min-h-11 rounded bg-[#3f679b] px-4 py-2 text-[15px] font-medium text-white hover:bg-[#345580] disabled:opacity-60"
      >
        {pending ? "Posting..." : "Post job"}
      </button>
    </form>
  );
}
