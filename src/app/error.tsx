"use client";

import Link from "next/link";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg py-6">
      <div className="mb-5 h-2 w-16 rounded bg-[#ebb73f]" aria-hidden="true" />
      <p className="text-sm font-semibold uppercase tracking-wide text-[#3f679b]">Error</p>
      <h1 className="mt-2 text-2xl font-bold">Something went wrong</h1>
      <p className="mt-3 text-[15px] leading-relaxed">
        This page could not be loaded. Try again, or go back to the front page.
      </p>
      <div className="mt-5 flex flex-wrap gap-4 text-[15px]">
        <button type="button" onClick={() => reset()} className="text-[#3f679b] hover:underline">
          Try again
        </button>
        <Link href="/" className="text-[#3f679b] hover:underline">
          Top stories
        </Link>
      </div>
    </div>
  );
}
