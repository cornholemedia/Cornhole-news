import AdSlot from "@/components/AdSlot";
import { adsEnabled } from "@/lib/site";

export default function MobileAd() {
  if (!adsEnabled()) return null;

  return (
    <div className="mb-4 lg:hidden">
      <AdSlot placement="mobile_320x50" width={320} height={50} layout="banner" />
    </div>
  );
}
