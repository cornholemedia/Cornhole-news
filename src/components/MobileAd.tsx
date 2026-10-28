import AdSlot from "@/components/AdSlot";
import { getCurrentAd } from "@/lib/ads-server";
import { adsEnabled, advertiseEnabled } from "@/lib/site";

export default async function MobileAd() {
  if (!adsEnabled()) return null;

  const ad = await getCurrentAd("mobile_320x50");
  if (!ad && !advertiseEnabled()) return null;

  return (
    <div className="mb-4 lg:hidden">
      <AdSlot width={320} height={50} layout="banner" ad={ad} />
    </div>
  );
}
