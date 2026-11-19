import "server-only";

import { isAdId, type AdPlacement, type LiveAd } from "@/lib/ads";
import { adsEnabled } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";

type CurrentAdRow = {
  id?: string;
  image_url?: string;
  alt_text?: string;
};

function liveAd(row: CurrentAdRow | null | undefined): LiveAd | null {
  if (!row?.id || !row.image_url || !isAdId(row.id)) return null;
  if (!row.image_url.startsWith("https://")) return null;
  return {
    id: row.id,
    imageUrl: row.image_url,
    altText: row.alt_text?.trim() || "Advertisement",
  };
}

/** Current creative for one placement. Anonymous read so the page can be cached. */
export async function getCurrentAd(placement: AdPlacement): Promise<LiveAd | null> {
  if (!adsEnabled()) return null;

  try {
    const supabase = createPublicClient();
    if (!supabase) return null;
    const { data, error } = await supabase.rpc("current_ad", { p_placement: placement });
    if (error) {
      console.error("Could not load an ad:", error.message);
      return null;
    }
    const row = (Array.isArray(data) ? data[0] : data) as CurrentAdRow | null;
    return liveAd(row);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load an ad.";
    console.error("Could not load an ad:", message);
    return null;
  }
}
