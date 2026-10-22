"use server";

import { revalidatePath } from "next/cache";
import {
  AD_MIGRATION_HINT,
  isAdId,
  missingAdsSchema,
  parseAdDraft,
  type AdDraft,
} from "@/lib/ads";
import { createClient } from "@/lib/supabase/server";

export type AdActionResult = { ok: true } | { ok: false; error: string };

async function adminClient(): Promise<
  | { supabase: Awaited<ReturnType<typeof createClient>>; error: null }
  | { supabase: null; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase: null, error: "Sign in as an admin to do that." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    return { supabase: null, error: "You need an admin account to do that." };
  }

  return { supabase, error: null };
}

function saveError(message: string): string {
  if (missingAdsSchema(message)) return AD_MIGRATION_HINT;
  if (/42501|not allowed|row-level security/i.test(message)) {
    return "You need an admin account to do that.";
  }
  if (/ads_window_check/.test(message)) return "The end date must be after the start date.";
  if (/ads_image_url_check/.test(message)) return "The image needs an https link.";
  if (/ads_click_url_check/.test(message)) return "The click link needs an http or https address.";
  if (/ads_placement_check/.test(message)) return "Choose a placement.";
  if (/ads_name_check/.test(message)) return "Name is required and must be 80 characters or fewer.";
  return "That ad could not be saved.";
}

function revalidateAds() {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/ads");
}

function storedImagePath(imageUrl: string): string | null {
  const marker = "/storage/v1/object/public/ads/";
  const index = imageUrl.indexOf(marker);
  if (index < 0) return null;
  const path = decodeURIComponent(imageUrl.slice(index + marker.length).split("?")[0] ?? "");
  if (!path || path.includes("/") || path.includes("..")) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(path)) return null;
  return path;
}

export async function saveAd(draft: AdDraft): Promise<AdActionResult> {
  const parsed = parseAdDraft(draft);
  if (!parsed.ok) return parsed;

  const { supabase, error } = await adminClient();
  if (error || !supabase) return { ok: false, error: error ?? "You need an admin account to do that." };

  const values = {
    name: parsed.value.name,
    placement: parsed.value.placement,
    image_url: parsed.value.imageUrl,
    click_url: parsed.value.clickUrl,
    alt_text: parsed.value.altText,
    starts_at: parsed.value.startsAt,
    ends_at: parsed.value.endsAt,
    active: parsed.value.active,
  };

  const saved = parsed.value.id
    ? await supabase.from("ads").update(values).eq("id", parsed.value.id).select("id").maybeSingle()
    : await supabase.from("ads").insert(values).select("id").maybeSingle();

  if (saved.error) {
    console.error("Could not save an ad:", saved.error.message);
    return { ok: false, error: saveError(saved.error.message) };
  }
  if (!saved.data) return { ok: false, error: "That ad could not be saved." };

  revalidateAds();
  return { ok: true };
}

export async function deleteAd(id: string, imageUrl: string): Promise<AdActionResult> {
  if (!isAdId(id)) return { ok: false, error: "That ad could not be found." };

  const { supabase, error } = await adminClient();
  if (error || !supabase) return { ok: false, error: error ?? "You need an admin account to do that." };

  const { data, error: deleteError } = await supabase
    .from("ads")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (deleteError) {
    console.error("Could not delete an ad:", deleteError.message);
    return {
      ok: false,
      error: missingAdsSchema(deleteError.message) ? AD_MIGRATION_HINT : "That ad could not be deleted.",
    };
  }
  if (!data) return { ok: false, error: "That ad could not be deleted." };

  const path = storedImagePath(imageUrl);
  if (path) {
    const { error: storageError } = await supabase.storage.from("ads").remove([path]);
    if (storageError) console.error("Could not delete an ad image:", storageError.message);
  }

  revalidateAds();
  return { ok: true };
}
