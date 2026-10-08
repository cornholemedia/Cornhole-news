import Link from "next/link";
import type { Metadata } from "next";
import EditPageLink from "@/components/EditPageLink";
import PageBody from "@/components/PageBody";
import {
  MIDWEST_STATES,
  employmentTypeLabel,
  isMidwestState,
  midwestStateName,
  paySummary,
  workTypeLabel,
  type MidwestStateCode,
} from "@/lib/job-board";
import { getPublicJobPostings } from "@/lib/job-postings";
import { PAGE_PRESENTATION } from "@/lib/page-content";
import { getPublishedPage } from "@/lib/pages";
import { pageMeta, summarize } from "@/lib/seo";

export const revalidate = 0;

const postButtonClass =
  "field-button inline-flex min-h-11 items-center justify-center rounded bg-[#3f679b] px-4 text-[15px] font-medium text-white hover:bg-[#345580] hover:no-underline";

function selectedState(value: string | undefined): MidwestStateCode | null {
  const code = value?.trim().toUpperCase() ?? "";
  return isMidwestState(code) ? code : null;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}): Promise<Metadata> {
  const { state: rawState } = await searchParams;
  const state = selectedState(rawState);
  const page = await getPublishedPage("jobs");
  const stateName = state ? midwestStateName(state) : "";
  const description =
    page.subtitle.trim() ||
    summarize(page.body) ||
    "Jobs located in the 12 Midwestern states.";

  return pageMeta({
    title: state ? `Jobs in ${stateName}` : page.title,
    description: state ? `Jobs in ${stateName} posted on Cornhole News.` : description,
    path: state ? `/jobs?state=${state}` : "/jobs",
  });
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state: rawState } = await searchParams;
  const state = selectedState(rawState);
  const [page, listings] = await Promise.all([
    getPublishedPage("jobs"),
    getPublicJobPostings(state),
  ]);
  const presentation = PAGE_PRESENTATION.jobs;
  const jobs = listings.jobs;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{page.title}</h1>
      {page.subtitle.trim() ? <p className={presentation.subtitleClass}>{page.subtitle}</p> : null}
      <p className="mb-6">
        <Link href="/jobs/post" className={postButtonClass}>
          Post a job
        </Link>
      </p>
      <div className={presentation.cardClass}>
        <PageBody body={page.body} headingClass={presentation.headingClass} />
      </div>
      <EditPageLink slug="jobs" />

      <section className="mt-8" aria-labelledby="open-jobs-heading">
        <h2 id="open-jobs-heading" className="mb-3 text-lg font-semibold">
          Open jobs
        </h2>
        <form method="get" action="/jobs" className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 sm:w-64">
            <label htmlFor="job-state-filter" className="field-label">
              State
            </label>
            <select
              id="job-state-filter"
              name="state"
              defaultValue={state ?? ""}
              className="field-input"
            >
              <option value="">All Midwest states</option>
              {MIDWEST_STATES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="field-button min-h-11 rounded border border-[#3f679b] bg-white px-4 text-[15px] font-medium text-[#3f679b]"
          >
            Show jobs
          </button>
          {state ? (
            <Link href="/jobs" className="inline-flex min-h-11 items-center text-sm text-[#3f679b] hover:underline">
              All states
            </Link>
          ) : null}
        </form>

        {listings.loadError ? (
          <p role="alert" className="mb-4 rounded border border-red-700 bg-white p-3 text-sm text-red-700">
            Job listings could not be loaded right now.
          </p>
        ) : null}

        {jobs.length === 0 ? (
          <div className="rounded border border-[#e0e0e0] bg-white p-5">
            <p className="text-[15px] leading-relaxed text-[#1a1a1a]">
              {state
                ? `No current jobs in ${midwestStateName(state)}.`
                : "No Midwest jobs are listed right now."}{" "}
              Employers can post a job for free. It is reviewed before it appears here.
            </p>
            <p className="mt-4">
              <Link href="/jobs/post" className={postButtonClass}>
                Post a job
              </Link>
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {jobs.map((job) => (
              <li key={job.id}>
                <article className="rounded border border-[#e0e0e0] bg-white p-4">
                  <h3 className="text-lg font-semibold">
                    <Link href={`/jobs/${job.id}`} className="text-[#3f679b] hover:underline">
                      {job.title}
                    </Link>
                  </h3>
                  <p className="mt-1 text-[15px] text-[#1a1a1a]">{job.companyName}</p>
                  <p className="mt-1 text-sm text-[#3a3a3a]">
                    {job.city}, {midwestStateName(job.state)} · {workTypeLabel(job.workType)} ·{" "}
                    {employmentTypeLabel(job.employmentType)}
                  </p>
                  <p className="mt-1 text-sm text-[#1a1a1a]">{paySummary(job)}</p>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
