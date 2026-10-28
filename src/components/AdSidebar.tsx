import AdSlot from "@/components/AdSlot";
import { getCurrentAd } from "@/lib/ads-server";
import { adsEnabled, advertiseEnabled } from "@/lib/site";

export default async function AdSidebar() {
  if (!adsEnabled()) return null;

  const showPlaceholders = advertiseEnabled();
  const [top, tall] = await Promise.all([
    getCurrentAd("sidebar_300x250"),
    getCurrentAd("sidebar_300x600"),
  ]);
  if (!showPlaceholders && !top && !tall) return null;

  return (
    <aside className="hidden w-[300px] shrink-0 lg:block">
      <div className="sticky top-4 space-y-4">
        {top || showPlaceholders ? (
          <AdSlot
            width={300}
            height={250}
            layout="sidebar"
            ad={top}
            advertiseLink={showPlaceholders}
          />
        ) : null}
        {tall || showPlaceholders ? (
          <AdSlot width={300} height={600} layout="sidebar" ad={tall} />
        ) : null}
      </div>
    </aside>
  );
}
