import "server-only";

import { AD_MIGRATION_HINT, isAdPlacement, missingAdsSchema, type AdminAd, type AdPlacement } from "@/lib/ads";
import { createClient } from "@/lib/supabase/server";

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
