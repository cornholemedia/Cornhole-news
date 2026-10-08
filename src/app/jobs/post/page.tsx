import type { Metadata } from "next";
import Link from "next/link";
import JobPostForm from "@/components/JobPostForm";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Post a job",
  description: "Post a free job located in the Midwest. Cornhole News reviews it before it appears.",
  path: "/jobs/post",
});

export default function PostJobPage() {
  return (
    <div>
      <p className="mb-3 text-sm">
        <Link href="/jobs" className="text-[#3f679b] hover:underline">
          Back to jobs
        </Link>
      </p>
      <h1 className="mb-2 text-2xl font-bold">Post a job</h1>
      <p className="mb-6 text-[15px] leading-relaxed text-[#3a3a3a]">
        List a real job located in the 12 Midwestern states. Posting is free. We review each
        submission before it appears, and an approved job stays up for 30 days.
      </p>
      <section className="rounded border border-[#e0e0e0] bg-white p-5">
        <JobPostForm />
      </section>
    </div>
  );
}
