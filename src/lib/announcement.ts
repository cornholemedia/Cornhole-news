export const ANNOUNCEMENT_MAX = 280;
export const ANNOUNCEMENT_MIGRATION = "supabase/migrations/20261104_site_announcement.sql";

export const ANNOUNCEMENT_MIGRATION_HINT =
  "The announcement banner is not in the database yet. In Supabase, open the SQL editor and run supabase/migrations/20261104_site_announcement.sql.";

export type AnnouncementDraft = {
  body: string;
  linkUrl: string | null;
  active: boolean;
};

export function parseAnnouncement(input: {
  body: string;
  linkUrl: string;
  active: boolean;
}): { ok: true; value: AnnouncementDraft } | { ok: false; error: string } {
  const body = input.body.replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim();
  if (body.length > ANNOUNCEMENT_MAX) {
    return { ok: false, error: "The banner must be 280 characters or fewer." };
  }
  if (input.active && !body) {
    return { ok: false, error: "Write the banner text before turning it on." };
  }

  const link = input.linkUrl.trim();
  if (!link) return { ok: true, value: { body, linkUrl: null, active: input.active } };
  if (!isAnnouncementLink(link)) {
    return { ok: false, error: "The link must be an https address or a page on this site." };
  }
  return { ok: true, value: { body, linkUrl: link, active: input.active } };
}

export function isAnnouncementLink(value: string): boolean {
  if (value.length > 2000 || /[\u0000-\u001F\u007F\s]/.test(value)) return false;
  if (value.startsWith("//") || value.includes("\\")) return false;
  if (value === "/" || /^\/[^/]/.test(value)) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    if (!url.hostname.includes(".")) return false;
    return true;
  } catch {
    return false;
  }
}
