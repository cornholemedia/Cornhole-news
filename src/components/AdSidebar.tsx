import AdSlot from "@/components/AdSlot";
import { adsEnabled } from "@/lib/site";

export default function AdSidebar() {
  if (!adsEnabled()) return null;

  return (
    <aside className="hidden w-[300px] shrink-0 lg:block">
      <div className="sticky top-4 space-y-4">
        <AdSlot
          placement="sidebar_300x250"
          width={300}
          height={250}
          layout="sidebar"
          advertiseLink
        />
        <AdSlot placement="sidebar_300x600" width={300} height={600} layout="sidebar" />
      </div>
    </aside>
  );
}
