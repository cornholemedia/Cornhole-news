import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-6">
      <div className="mb-5 h-2 w-16 rounded bg-[#ebb73f]" aria-hidden="true" />
      <p className="text-sm font-semibold uppercase tracking-wide text-[#3f679b]">404</p>
      <h1 className="mt-2 text-2xl font-bold">This page isn&apos;t here</h1>
      <p className="mt-3 text-[15px] leading-relaxed">
        The link may be out of date, or the page may have moved. Try one of these instead.
      </p>
      <ul className="mt-5 space-y-2 text-[15px]">
        <li>
          <Link href="/" className="text-[#3f679b] hover:underline">
            Top stories
          </Link>
        </li>
        <li>
          <Link href="/new" className="text-[#3f679b] hover:underline">
            New stories
          </Link>
        </li>
        <li>
          <Link href="/submit" className="text-[#3f679b] hover:underline">
            Submit a story
          </Link>
        </li>
        <li>
          <Link href="/contact" className="text-[#3f679b] hover:underline">
            Contact
          </Link>
        </li>
      </ul>
    </div>
  );
}
