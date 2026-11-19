import JobsListing, { jobsMetadata } from "@/app/jobs/listing";

export const revalidate = 3600;

export function generateMetadata() {
  return jobsMetadata(null);
}

export default function JobsPage() {
  return <JobsListing state={null} />;
}
