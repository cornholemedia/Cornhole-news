import Link from "next/link";
import JobPostingsAdmin from "@/components/JobPostingsAdmin";
import NewsletterAdmin from "@/components/NewsletterAdmin";
import SiteSettingsForm from "@/components/SiteSettingsForm";
import { getDigestAdminSummary } from "@/lib/digest-review";
import { getJobPostingsForAdmin } from "@/lib/job-postings";
import { getNewsletterSubscribersForAdmin } from "@/lib/newsletter";
import { getPagesForAdmin } from "@/lib/pages";
import { getSiteSettingsForAdmin } from "@/lib/site-settings";
import { advertiseEnabled } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function AdminPagesIndex() {
  const [pages, settings, newsletter, jobs, digest] = await Promise.all([
    getPagesForAdmin(),
    getSiteSettingsForAdmin(),
    getNewsletterSubscribersForAdmin(),
    getJobPostingsForAdmin(),
    getDigestAdminSummary(),
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
        . The daily Midwest digest is reviewed before it is posted.
      </p>

      <section className="mb-8 rounded border border-[#e0e0e0] bg-white p-4" aria-labelledby="digest-admin-heading">
        <h2 id="digest-admin-heading" className="font-semibold">
          Midwest digest
        </h2>
        <p className="mt-1 text-sm text-[#3a3a3a]">
          Stories sent by the daily digest stay hidden until you publish them.
          {digest.pendingCount > 0
            ? ` ${digest.pendingCount} ${digest.pendingCount === 1 ? "story is" : "stories are"} waiting.`
            : ""}
        </p>
        {digest.loadError ? (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {digest.loadError}
          </p>
        ) : null}
        <p className="mt-3 text-sm">
          <Link href="/admin/review" className="text-[#3f679b] hover:underline">
            Review digest
          </Link>
        </p>
      </section>

      <section className="mb-8 rounded border border-[#e0e0e0] bg-white p-4" aria-labelledby="ads-admin-heading">
        <h2 id="ads-admin-heading" className="font-semibold">
          Ads
        </h2>
        <p className="mt-1 text-sm text-[#3a3a3a]">
          Sidebar and mobile creatives, with impression and click counts.
        </p>
        <p className="mt-3 text-sm">
          <Link href="/admin/ads" className="text-[#3f679b] hover:underline">
            Manage ads
          </Link>
        </p>
      </section>

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
              {page.slug !== "advertise" || advertiseEnabled() ? (
                <Link href={`/${page.slug}`} className="text-[#3f679b] hover:underline">
                  View
                </Link>
              ) : null}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
