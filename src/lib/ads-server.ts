import "server-only";

import { connection } from "next/server";
import { AD_MIGRATION_HINT, isAdId, isAdPlacement, missingAdsSchema, type AdminAd, type AdPlacement, type LiveAd } from "@/lib/ads";
import { adsEnabled } from "@/lib/site";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

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

export async function getCurrentAd(placement: AdPlacement): Promise<LiveAd | null> {
  if (!adsEnabled() || !isSupabaseConfigured()) return null;

  try {
    await connection();
    const supabase = await createClient();
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

type AdminAdRow = {
  id: string;
  name: string;
  placement: string;
  image_url: string;
  click_url: string;
  alt_text: string;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  impressions: number;
  clicks: number;
  created_at: string;
};

export async function getAdsForAdmin(): Promise<{ ads: AdminAd[]; loadError: string | null }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ads")
      .select(
        "id, name, placement, image_url, click_url, alt_text, starts_at, ends_at, active, impressions, clicks, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("Could not load ads:", error.message);
      return {
        ads: [],
        loadError: missingAdsSchema(error.message) ? AD_MIGRATION_HINT : error.message,
      };
    }

    const ads: AdminAd[] = ((data ?? []) as AdminAdRow[]).flatMap((row) => {
      if (!isAdPlacement(row.placement)) return [];
      const placement: AdPlacement = row.placement;
      return [
        {
          id: row.id,
          name: row.name,
          placement,
          imageUrl: row.image_url,
          clickUrl: row.click_url,
          altText: row.alt_text,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          active: row.active === true,
          impressions: Number(row.impressions) || 0,
          clicks: Number(row.clicks) || 0,
          createdAt: row.created_at,
        },
      ];
    });

    return { ads, loadError: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load ads.";
    console.error("Could not load ads:", message);
    return {
      ads: [],
      loadError: missingAdsSchema(message) ? AD_MIGRATION_HINT : message,
    };
  }
}
