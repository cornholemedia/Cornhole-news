import { notFound } from "next/navigation";
import JobPostingEditor from "@/components/JobPostingEditor";
import { getJobPostingForAdmin, isJobId } from "@/lib/job-postings";

export const dynamic = "force-dynamic";

export default async function AdminJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isJobId(id)) notFound();

  const { posting, loadError } = await getJobPostingForAdmin(id);
  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-2xl font-bold">Edit job posting</h1>
        <p role="alert" className="rounded border border-[#e0e0e0] bg-white p-4 text-sm text-red-700">
          {loadError}
        </p>
      </div>
    );
  }
  if (!posting) notFound();

  return <JobPostingEditor job={posting} />;
}
