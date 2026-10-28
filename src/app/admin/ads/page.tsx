import type { Metadata } from "next";
import Link from "next/link";
import AdsAdmin from "@/components/AdsAdmin";
import { getAdsForAdmin } from "@/lib/ads-server";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Ads",
  description: "Choose the ads that run in the sidebar and the mobile banner.",
  path: "/admin/ads",
  noIndex: true,
});

export default async function AdminAdsPage() {
  const { ads, loadError } = await getAdsForAdmin();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold">Ads</h1>
      <p className="mb-3 text-[15px] leading-relaxed text-[#666]">
        Put a creative in the sidebar or the phone banner. A slot with more than one
        live ad picks one at random. Turn Active off, or set dates, to stop it. An
        empty slot shows the dashed placeholder when{" "}
        <code>NEXT_PUBLIC_SHOW_ADVERTISE=true</code>. Live ads stay hidden until{" "}
        <code>SHOW_ADS=true</code>.
      </p>
      <p className="mb-6 text-sm">
        <Link href="/admin" className="text-[#3f679b] hover:underline">
          Back to admin
        </Link>
      </p>
      <AdsAdmin ads={ads} loadError={loadError} />
    </div>
  );
}
