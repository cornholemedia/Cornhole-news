import "server-only";

import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import {
  ANNOUNCEMENT_MIGRATION_HINT,
  type AnnouncementDraft,
} from "@/lib/announcement";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type PublicAnnouncement = {
  body: string;
  linkUrl: string | null;
};

function fromRow(row: { body?: string; link_url?: string | null; active?: boolean } | null): AnnouncementDraft {
  return {
    body: typeof row?.body === "string" ? row.body : "",
    linkUrl: typeof row?.link_url === "string" && row.link_url ? row.link_url : null,
    active: row?.active === true,
  };
}

export async function getActiveAnnouncement(): Promise<PublicAnnouncement | null> {
  try {
    await connection();
    if (!isSupabaseConfigured()) return null;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("site_announcement")
      .select("body, link_url, active")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data?.active) return null;
    const draft = fromRow(data);
    if (!draft.body) return null;
    return { body: draft.body, linkUrl: draft.linkUrl };
  } catch (error) {
    unstable_rethrow(error);
    console.error(
      "Could not load the announcement:",
      error instanceof Error ? error.message : "unknown error"
    );
    return null;
  }
}

export async function getAnnouncementForAdmin(): Promise<{
  announcement: AnnouncementDraft;
  loadError: string | null;
}> {
  const empty: AnnouncementDraft = { body: "", linkUrl: null, active: false };
  if (!isSupabaseConfigured()) {
    return { announcement: empty, loadError: "Supabase is not configured." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("site_announcement")
      .select("body, link_url, active")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.error("Could not load the announcement:", error.message);
      const missing = /site_announcement|schema cache|does not exist/i.test(error.message);
      return {
        announcement: empty,
        loadError: missing ? ANNOUNCEMENT_MIGRATION_HINT : error.message,
      };
    }
    if (!data) return { announcement: empty, loadError: ANNOUNCEMENT_MIGRATION_HINT };
    return { announcement: fromRow(data), loadError: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the announcement.";
    console.error("Could not load the announcement:", message);
    return { announcement: empty, loadError: message };
  }
}
