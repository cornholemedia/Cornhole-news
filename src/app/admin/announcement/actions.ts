"use server";

import { revalidatePath } from "next/cache";
import { ANNOUNCEMENT_MIGRATION_HINT, parseAnnouncement } from "@/lib/announcement";
import { adminClient } from "@/lib/admin-session";

export async function saveAnnouncement(input: {
  body: string;
  linkUrl: string;
  active: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof input.body !== "string" || typeof input.linkUrl !== "string" || typeof input.active !== "boolean") {
    return { ok: false, error: "That banner could not be saved." };
  }

  const parsed = parseAnnouncement(input);
  if (!parsed.ok) return parsed;

  const { supabase, error } = await adminClient();
  if (error || !supabase) return { ok: false, error: error ?? "You need an admin account to do that." };

  const { data, error: saveError } = await supabase
    .from("site_announcement")
    .update({
      body: parsed.value.body,
      link_url: parsed.value.linkUrl,
      active: parsed.value.active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1)
    .select("id")
    .maybeSingle();

  if (saveError) {
    console.error("Could not save the announcement:", saveError.message);
    const missing = /site_announcement|schema cache|does not exist/i.test(saveError.message);
    return { ok: false, error: missing ? ANNOUNCEMENT_MIGRATION_HINT : "That banner could not be saved." };
  }
  if (!data) return { ok: false, error: ANNOUNCEMENT_MIGRATION_HINT };

  revalidatePath("/", "layout");
  revalidatePath("/admin/announcement");
  return { ok: true };
}
