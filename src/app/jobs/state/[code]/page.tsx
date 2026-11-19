import { notFound, redirect } from "next/navigation";
import JobsListing, { jobsMetadata } from "@/app/jobs/listing";
import { MIDWEST_STATES, isMidwestState } from "@/lib/job-board";

export const revalidate = 3600;

export function generateStaticParams() {
  return MIDWEST_STATES.map((state) => ({ code: state.code }));
}

function stateCode(value: string) {
  const code = value.trim().toUpperCase();
  if (value !== code) redirect(`/jobs/state/${code}`);
  if (!isMidwestState(code)) notFound();
  return code;
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return jobsMetadata(stateCode(code));
}

export default async function JobsByStatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <JobsListing state={stateCode(code)} />;
}
