import Link from "next/link";
import JobPostingsAdmin from "@/components/JobPostingsAdmin";
import NewsletterAdmin from "@/components/NewsletterAdmin";
import SiteSettingsForm from "@/components/SiteSettingsForm";
import { getJobPostingsForAdmin } from "@/lib/job-postings";
import { getNewsletterSubscribersForAdmin } from "@/lib/newsletter";
import { getPagesForAdmin } from "@/lib/pages";
import { getSiteSettingsForAdmin } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function AdminPagesIndex() {
  const [pages, settings, newsletter, jobs] = await Promise.all([
    getPagesForAdmin(),
    getSiteSettingsForAdmin(),
    getNewsletterSubscribersForAdmin(),
    getJobPostingsForAdmin(),
  ]);
  const loadError = pages.find((page) => page.loadError)?.loadError ?? null;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold">Edit pages</h1>
      <p className="mb-6 text-[15px] leading-relaxed text-[#666]">
        Change About, Jobs, Advertise, Privacy, Terms, and Contact. The email addresses
        below are where the contact form and new job postings are sent. Review employer
        job posts here before they appear on the jobs page. Newsletter signups from the
        footer are listed here too. Posts still go through{" "}
        <Link href="/submit" className="text-[#3f679b] hover:underline">
          Submit
        </Link>
        .
      </p>

      <div className="mb-8">
        <SiteSettingsForm
          contactEmail={settings.contactEmail}
          jobsEmail={settings.jobsEmail}
          stored={settings.stored}
          loadError={settings.loadError}
        />
      </div>

      <div className="mb-8">
        <JobPostingsAdmin
          postings={jobs.postings}
          pendingCount={jobs.pendingCount}
          loadError={jobs.loadError}
        />
      </div>

      <div className="mb-8">
        <NewsletterAdmin list={newsletter} />
      </div>

      {loadError && (
        <p className="mb-4 rounded border border-[#e0e0e0] bg-white p-4 text-sm text-red-600">
          Could not read stored pages ({loadError}). If this is a new database,
          run <code>supabase/migrations/20260923_editable_pages.sql</code>,{" "}
          <code>supabase/migrations/20260930_legal_pages.sql</code>, and{" "}
          <code>supabase/migrations/20261007_legal_pages_text.sql</code> in the Supabase
          SQL editor. The public site keeps showing the built-in copy until then.
        </p>
      )}

      {!loadError && pages.some((page) => !page.stored) && (
        <p className="mb-4 rounded border border-[#e0e0e0] bg-white p-4 text-sm text-[#666]">
          Pages marked “built-in copy” are not saved in the database yet. To add
          Privacy, Terms, and Contact, open the Supabase SQL editor and run{" "}
          <code>supabase/migrations/20260930_legal_pages.sql</code>, then{" "}
          <code>supabase/migrations/20261007_legal_pages_text.sql</code>.
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
