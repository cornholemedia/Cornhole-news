import type { Metadata } from "next";
import Link from "next/link";
import AnnouncementForm from "@/components/AnnouncementForm";
import { getAnnouncementForAdmin } from "@/lib/announcement-server";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Announcement",
  description: "Set the banner at the top of Cornhole News.",
  path: "/admin/announcement",
  noIndex: true,
});

export default async function AdminAnnouncementPage() {
  const { announcement, loadError } = await getAnnouncementForAdmin();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold">Announcement</h1>
      <p className="mb-3 text-[15px] leading-relaxed text-[#666]">
        This banner sits at the top of the site. Turn it off to hide it. Saving
        updates the public pages without a new deploy.
      </p>
      <p className="mb-6 text-sm">
        <Link href="/admin" className="text-[#3f679b] hover:underline">
          Back to admin
        </Link>
      </p>
      {loadError ? (
        <p role="alert" className="rounded border border-[#e0e0e0] bg-white p-4 text-sm text-red-700">
          {loadError}
        </p>
      ) : (
        <AnnouncementForm initial={announcement} />
      )}
    </div>
  );
}
