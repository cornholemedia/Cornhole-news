export default function JobsPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Jobs</h1>
      <p className="mb-6 text-[15px] text-[#666]">
        Cornhole-related job openings and opportunities.
      </p>

      <div className="space-y-4">
        <div className="rounded border border-[#e0e0e0] bg-white p-4">
          <h2 className="font-semibold">No jobs posted yet</h2>
          <p className="mt-1 text-sm text-[#666]">
            Check back later, or{" "}
            <a href="/advertise" className="text-[#3f679b] hover:underline">
              contact us
            </a>{" "}
            if you&apos;d like to post a position.
          </p>
        </div>
      </div>
    </div>
  );
}
