import "server-only";

import { unstable_rethrow } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";

export type PublicAnnouncement = {
  body: string;
  linkUrl: string | null;
};

function fromRow(row: { body?: string; link_url?: string | null; active?: boolean } | null): {
  body: string;
  linkUrl: string | null;
  active: boolean;
} {
  return {
    body: typeof row?.body === "string" ? row.body : "",
    linkUrl: typeof row?.link_url === "string" && row.link_url ? row.link_url : null,
    active: row?.active === true,
  };
}

/** Live banner. Anonymous read so the layout can be cached with the page. */
export async function getActiveAnnouncement(): Promise<PublicAnnouncement | null> {
  try {
    const supabase = createPublicClient();
    if (!supabase) return null;
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
