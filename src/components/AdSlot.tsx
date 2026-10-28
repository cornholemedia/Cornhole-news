import Link from "next/link";
import AdImpression from "@/components/AdImpression";
import { type LiveAd } from "@/lib/ads";
import { adsEnabled, advertiseEnabled } from "@/lib/site";

export default function AdSlot({
  width,
  height,
  layout,
  ad,
  advertiseLink = false,
}: {
  width: number;
  height: number;
  layout: "sidebar" | "banner";
  ad: LiveAd | null;
  advertiseLink?: boolean;
}) {
  if (!adsEnabled()) return null;
  if (!ad && !advertiseEnabled()) return null;

  const banner = layout === "banner";
  const showAdvertiseLink = advertiseLink && advertiseEnabled();

  return (
    <div
      className={
        banner
          ? "mx-auto w-full max-w-[320px] text-center"
          : "rounded border border-[#e0e0e0] bg-white p-3 text-center"
      }
    >
      <p className={`uppercase tracking-wide text-[#666] ${banner ? "mb-1 text-[10px]" : "mb-2 text-xs"}`}>
        Advertisement
      </p>
      {ad ? (
        <a
          href={`/api/ads/click/${ad.id}`}
          target="_blank"
          rel="sponsored noopener"
          className="mx-auto block overflow-hidden rounded border border-[#e0e0e0] bg-white"
          style={{ height, maxWidth: width }}
        >
          {/* Advertiser images are arbitrary https hosts, so next/image cannot whitelist them. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ad.imageUrl}
            alt={ad.altText}
            width={width}
            height={height}
            className="h-full w-full object-contain"
          />
          <AdImpression id={ad.id} />
        </a>
      ) : (
        <div
          className="mx-auto flex items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-400"
          style={{ height, maxWidth: width }}
        >
          <span>
            {width} × {height}
            <br />
            Ad Placeholder
          </span>
        </div>
      )}
      {showAdvertiseLink ? (
        <p className="mt-2 text-xs text-[#3f679b]">
          <Link href="/advertise" className="hover:underline">
            Advertise with us
          </Link>
        </p>
      ) : null}
    </div>
  );
}
