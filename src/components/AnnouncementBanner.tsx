import Link from "next/link";
import { getActiveAnnouncement } from "@/lib/announcement-server";

export default async function AnnouncementBanner() {
  const banner = await getActiveAnnouncement();
  if (!banner) return null;

  const className = "underline decoration-white/70 underline-offset-2 hover:decoration-white";
  const text = banner.linkUrl ? (
    banner.linkUrl.startsWith("/") ? (
      <Link href={banner.linkUrl} className={className}>
        {banner.body}
      </Link>
    ) : (
      <a href={banner.linkUrl} className={className} target="_blank" rel="noopener noreferrer">
        {banner.body}
      </a>
    )
  ) : (
    banner.body
  );

  return (
    <div className="bg-[#3f679b] px-4 py-2 text-center text-sm leading-snug text-white">
      <p className="mx-auto max-w-6xl break-words">{text}</p>
    </div>
  );
}
