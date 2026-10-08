import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  employmentTypeLabel,
  formatMidwestDate,
  jobPostingJsonLd,
  jsonLdScript,
  midwestStateName,
  paySummary,
  workTypeLabel,
} from "@/lib/job-board";
import { getPublicJobPosting, isJobId } from "@/lib/job-postings";
import { pageMeta, summarize } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site";

export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { job } = isJobId(id) ? await getPublicJobPosting(id) : { job: null };

  if (!job) {
    return pageMeta({
      title: "Job not found",
      description: "That job is not on Cornhole News.",
      path: `/jobs/${id}`,
      noIndex: true,
    });
  }

  return pageMeta({
    title: `${job.title} at ${job.companyName}`,
    description: summarize(
      `${job.title} in ${job.city}, ${midwestStateName(job.state)}. ${job.description}`
    ),
    path: `/jobs/${job.id}`,
  });
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isJobId(id)) notFound();

  const { job, loadError } = await getPublicJobPosting(id);
  if (loadError) {
    return (
      <div>
        <p className="mb-3 text-sm">
          <Link href="/jobs" className="text-[#3f679b] hover:underline">
            Back to jobs
          </Link>
        </p>
        <h1 className="mb-2 text-2xl font-bold">Job</h1>
        <p role="alert" className="rounded border border-red-700 bg-white p-3 text-sm text-red-700">
          This job could not be loaded right now.
        </p>
      </div>
    );
  }
  if (!job) notFound();

  const pageUrl = `${getSiteUrl()}/jobs/${job.id}`;
  const structuredData = jsonLdScript(jobPostingJsonLd(job, pageUrl));

  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      <p className="mb-3 text-sm">
        <Link href="/jobs" className="text-[#3f679b] hover:underline">
          Back to jobs
        </Link>
      </p>
      <h1 className="text-2xl font-bold text-[#1a1a1a]">{job.title}</h1>
      <p className="mt-2 text-[15px] text-[#1a1a1a]">
        {job.companyWebsite ? (
          <a href={job.companyWebsite} className="text-[#3f679b] hover:underline" target="_blank" rel="noopener noreferrer">
            {job.companyName}
          </a>
        ) : (
          job.companyName
        )}
      </p>
      <p className="mt-2 text-sm text-[#3a3a3a]">
        {job.city}, {midwestStateName(job.state)} · {workTypeLabel(job.workType)} ·{" "}
        {employmentTypeLabel(job.employmentType)}
      </p>
      <p className="mt-2 text-[15px] text-[#1a1a1a]">{paySummary(job)}</p>
      <p className="mt-2 text-sm text-[#3a3a3a]">
        Posted {formatMidwestDate(job.approvedAt ?? job.createdAt)}
        {job.expiresAt ? ` · Open through ${formatMidwestDate(job.expiresAt)}` : ""}
      </p>

      <div className="mt-6 whitespace-pre-wrap text-[15px] leading-relaxed text-[#1a1a1a]">
        {job.description}
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        {job.applyUrl ? (
          <a
            href={job.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="field-button inline-flex min-h-11 items-center justify-center rounded bg-[#3f679b] px-4 text-[15px] font-medium text-white hover:bg-[#345580] hover:no-underline"
          >
            Apply on the company site
          </a>
        ) : null}
        {job.applyEmail ? (
          <a
            href={`mailto:${encodeURIComponent(job.applyEmail)}`}
            className="field-button inline-flex min-h-11 items-center justify-center rounded border border-[#3f679b] bg-white px-4 text-[15px] font-medium text-[#3f679b] hover:no-underline"
          >
            Apply by email
          </a>
        ) : null}
      </div>
    </article>
  );
}
