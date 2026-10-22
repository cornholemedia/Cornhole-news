export const AD_MIGRATION_PATH = "supabase/migrations/20261022_ads.sql";

export const AD_MIGRATION_HINT =
  "Ads are not in the database yet. In Supabase, open the SQL editor and run supabase/migrations/20261022_ads.sql.";

export const AD_PLACEMENTS = [
  { id: "sidebar_300x250", label: "Sidebar 300×250", width: 300, height: 250 },
  { id: "sidebar_300x600", label: "Sidebar 300×600", width: 300, height: 600 },
  { id: "mobile_320x50", label: "Mobile 320×50", width: 320, height: 50 },
] as const;

export type AdPlacement = (typeof AD_PLACEMENTS)[number]["id"];

const AD_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

export const AD_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export type AdDraft = {
  id?: string;
  name: string;
  placement: string;
  imageUrl: string;
  clickUrl: string;
  altText: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
};

export type ParsedAd = {
  id: string | null;
  name: string;
  placement: AdPlacement;
  imageUrl: string;
  clickUrl: string;
  altText: string;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
};

export type LiveAd = {
  id: string;
  imageUrl: string;
  altText: string;
};

export type AdminAd = ParsedAd & {
  id: string;
  impressions: number;
  clicks: number;
  createdAt: string;
};

export function isAdPlacement(value: string): value is AdPlacement {
  return AD_PLACEMENTS.some((item) => item.id === value);
}

export function placementLabel(value: string): string {
  return AD_PLACEMENTS.find((item) => item.id === value)?.label ?? value;
}

export function isAdId(value: string): boolean {
  return AD_ID.test(value);
}

export function adImageExtension(type: string): string | null {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/gif") return "gif";
  if (type === "image/webp") return "webp";
  return null;
}

export function isAdImageType(type: string): boolean {
  return (IMAGE_TYPES as readonly string[]).includes(type);
}

export function missingAdsSchema(message: string): boolean {
  return /schema cache|does not exist|could not find the function|current_ad|increment_ad_impression|record_ad_click/i.test(
    message
  );
}

function oneLine(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}

function cleanUrl(value: string, protocols: string[]): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 12 || trimmed.length > 2000) return null;
  if (/[\u0000-\u001F\u007F\s]/.test(trimmed)) return null;
  if (!protocols.some((protocol) => trimmed.startsWith(`${protocol}://`))) return null;
  if (/^https?:\/\/[^/?#]*@/i.test(trimmed)) return null;

  try {
    const url = new URL(trimmed);
    if (!protocols.includes(url.protocol.replace(":", ""))) return null;
    if (url.username || url.password) return null;
    if (!url.hostname.includes(".")) return null;
  } catch {
    return null;
  }

  return trimmed;
}

function parseTimestamp(value: string, label: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, error: `Enter a real ${label}.` };
  }
  return { ok: true, value: parsed.toISOString() };
}

export function parseAdDraft(
  draft: AdDraft
): { ok: true; value: ParsedAd } | { ok: false; error: string } {
  const name = oneLine(draft.name);
  if (!name || name.length > 80) {
    return { ok: false, error: "Name is required and must be 80 characters or fewer." };
  }

  if (!isAdPlacement(draft.placement)) {
    return { ok: false, error: "Choose a placement." };
  }

  const imageUrl = cleanUrl(draft.imageUrl, ["https"]);
  if (!imageUrl) {
    return { ok: false, error: "The image needs an https link." };
  }

  const clickUrl = cleanUrl(draft.clickUrl, ["http", "https"]);
  if (!clickUrl) {
    return { ok: false, error: "The click link needs an http or https address." };
  }

  const altText = oneLine(draft.altText);
  if (altText.length > 200) {
    return { ok: false, error: "Alt text must be 200 characters or fewer." };
  }

  const starts = parseTimestamp(draft.startsAt, "start date");
  if (!starts.ok) return starts;
  const ends = parseTimestamp(draft.endsAt, "end date");
  if (!ends.ok) return ends;
  if (starts.value && ends.value && Date.parse(ends.value) <= Date.parse(starts.value)) {
    return { ok: false, error: "The end date must be after the start date." };
  }

  const id = draft.id?.trim() ?? "";
  if (id && !isAdId(id)) {
    return { ok: false, error: "That ad could not be found." };
  }

  return {
    ok: true,
    value: {
      id: id || null,
      name,
      placement: draft.placement,
      imageUrl,
      clickUrl,
      altText,
      startsAt: starts.value,
      endsAt: ends.value,
      active: draft.active === true,
    },
  };
}

export function safeAdClickUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return cleanUrl(value, ["http", "https"]);
}

export function adScheduleLabel(ad: {
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
}, now = Date.now()): "Live" | "Scheduled" | "Ended" | "Off" {
  if (!ad.active) return "Off";
  if (ad.startsAt && Date.parse(ad.startsAt) > now) return "Scheduled";
  if (ad.endsAt && Date.parse(ad.endsAt) <= now) return "Ended";
  return "Live";
}
