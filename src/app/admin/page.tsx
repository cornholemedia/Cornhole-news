import Link from "next/link";
import { getPagesForAdmin } from "@/lib/pages";

export const dynamic = "force-dynamic";

export default async function AdminPagesIndex() {
  const pages = await getPagesForAdmin();
  const loadError = pages.find((page) => page.loadError)?.loadError ?? null;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold">Edit pages</h1>
      <p className="mb-6 text-[15px] leading-relaxed text-[#666]">
        Change the About, Jobs, and Advertise pages. Posts still go through{" "}
        <Link href="/submit" className="text-[#3f679b] hover:underline">
          Submit
        </Link>
        .
      </p>

      {loadError && (
        <p className="mb-4 rounded border border-[#e0e0e0] bg-white p-4 text-sm text-red-600">
          Could not read stored pages ({loadError}). If this is a new database,
          run <code>supabase/migrations/20260923_editable_pages.sql</code> in the
          Supabase SQL editor. The public site keeps showing the built-in copy
          until then.
        </p>
      )}

      <div className="space-y-3">
        {pages.map((page) => (
          <div key={page.slug} className="rounded border border-[#e0e0e0] bg-white p-4">
            <h2 className="font-semibold">{page.title}</h2>
            <p className="mt-1 text-sm text-[#666]">
              /{page.slug}
              {page.stored ? " · saved" : " · built-in copy"}
              {page.updatedAt
                ? ` · ${new Date(page.updatedAt).toLocaleString()}`
                : ""}
            </p>
            <p className="mt-3 flex gap-3 text-sm">
              <Link
                href={`/admin/pages/${page.slug}`}
                className="text-[#3f679b] hover:underline"
              >
                Edit
              </Link>
              <Link href={`/${page.slug}`} className="text-[#3f679b] hover:underline">
                View
              </Link>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
