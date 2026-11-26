/**
 * These match `RSS_FEED_PATH` and `CANONICAL_SITE_URL`. This file stays free of
 * local imports so `node --test` can load it the same way as the other tests.
 */
const FEED_PATH = "/rss.xml";
const FALLBACK_ORIGIN = "https://cornholenews.news";

/** Newest stories included in one feed document. */
export const RSS_FEED_LIMIT = 50;

/**
 * How long a cached feed stays fresh, in seconds.
 * Short enough that a drip story shows up within a few minutes of its slot.
 */
export const RSS_REVALIDATE_SECONDS = 180;

/** Cap a story blurb. Existing posts are shorter than this. */
const DESCRIPTION_MAX = 400;

const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export type RssItem = {
  id: number;
  title: string;
  description: string | null;
  publishedAt: string;
};

export type RssChannel = {
  siteUrl: string;
  siteName: string;
  description: string;
  items: RssItem[];
  now?: Date;
};

/** Map one public post row into a feed item. Invalid rows are dropped. */
export function toFeedItem(row: {
  id: unknown;
  title: unknown;
  body?: unknown;
  created_at?: unknown;
}): RssItem | null {
  const id = typeof row.id === "number" ? row.id : typeof row.id === "string" ? Number(row.id) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  if (typeof row.title !== "string") return null;
  const title = oneLine(row.title);
  if (!title) return null;

  const publishedAt = typeof row.created_at === "string" ? parseTimestamp(row.created_at) : null;
  if (!publishedAt) return null;

  const description =
    typeof row.body === "string" && oneLine(row.body) ? oneLine(row.body) : null;

  return {
    id,
    title,
    description,
    publishedAt: publishedAt.toISOString(),
  };
}

/**
 * Newest first, unique ids, at most `limit` items (never more than the feed cap).
 */
export function prepareFeedItems(items: readonly RssItem[], limit = RSS_FEED_LIMIT): RssItem[] {
  const size = clampLimit(limit);
  const seen = new Set<number>();
  const ready: RssItem[] = [];

  for (const item of items) {
    const normalized = toFeedItem({
      id: item.id,
      title: item.title,
      body: item.description,
      created_at: item.publishedAt,
    });
    if (!normalized || seen.has(normalized.id)) continue;
    seen.add(normalized.id);
    ready.push(normalized);
  }

  ready.sort((a, b) => {
    const byDate = Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
    if (byDate !== 0) return byDate;
    return b.id - a.id;
  });

  return ready.slice(0, size);
}

/** RSS 2.0 document. Item links are absolute story pages on the public site. */
export function buildRssFeed(channel: RssChannel): string {
  const origin = siteOrigin(channel.siteUrl);
  const self = `${origin}${FEED_PATH}`;
  const items = prepareFeedItems(channel.items);
  const now = channel.now ?? new Date();
  const newest = items[0] ? new Date(items[0].publishedAt) : now;
  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`,
    `  <channel>`,
    `    <title>${escapeXml(oneLine(channel.siteName) || "Cornhole News")}</title>`,
    `    <link>${escapeXml(origin)}</link>`,
    `    <description>${escapeXml(oneLine(channel.description))}</description>`,
    `    <language>en-us</language>`,
    `    <lastBuildDate>${escapeXml(toRfc822(now))}</lastBuildDate>`,
    `    <pubDate>${escapeXml(toRfc822(newest))}</pubDate>`,
    `    <ttl>${Math.round(RSS_REVALIDATE_SECONDS / 60)}</ttl>`,
    `    <atom:link href="${escapeXml(self)}" rel="self" type="application/rss+xml"/>`,
  ];

  for (const item of items) {
    const link = `${origin}/item/${item.id}`;
    const description = item.description ? shortDescription(item.description) : "";
    lines.push(`    <item>`);
    lines.push(`      <title>${escapeXml(item.title)}</title>`);
    lines.push(`      <link>${escapeXml(link)}</link>`);
    lines.push(`      <pubDate>${escapeXml(toRfc822(new Date(item.publishedAt)))}</pubDate>`);
    lines.push(`      <guid isPermaLink="true">${escapeXml(link)}</guid>`);
    if (description) {
      lines.push(`      <description>${escapeXml(description)}</description>`);
    }
    lines.push(`    </item>`);
  }

  lines.push(`  </channel>`, `</rss>`, ``);
  return lines.join("\n");
}

export function escapeXml(value: string): string {
  return value
    .replace(INVALID_XML, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** RFC 822 date, which is the form RSS 2.0 requires for pubDate. */
export function toRfc822(date: Date): string {
  return date.toUTCString();
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) return RSS_FEED_LIMIT;
  return Math.min(RSS_FEED_LIMIT, Math.max(0, Math.floor(limit)));
}

function oneLine(value: string): string {
  return value.replace(INVALID_XML, " ").replace(/\s+/g, " ").trim();
}

function shortDescription(value: string): string {
  const plain = oneLine(value);
  if (plain.length <= DESCRIPTION_MAX) return plain;
  return `${plain.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…`;
}

function parseTimestamp(value: string): Date | null {
  let trimmed = value.trim();
  if (!trimmed) return null;
  if (!trimmed.includes("T")) trimmed = trimmed.replace(" ", "T");
  // Postgres can print a numeric offset without a colon, which Date.parse rejects.
  trimmed = trimmed.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  trimmed = trimmed.replace(/([+-]\d{2})$/, "$1:00");
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function siteOrigin(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return FALLBACK_ORIGIN;
    return url.origin;
  } catch {
    return FALLBACK_ORIGIN;
  }
}
