/** Public RSS document. Newest published stories, capped so the file stays small. */
export const RSS_PATH = "/rss.xml";
export const RSS_ALIAS_PATH = "/feed";
export const RSS_LINK_TITLE = "Cornhole News RSS";
export const FEED_STORY_LIMIT = 50;
export const FEED_REVALIDATE_SECONDS = 300;
export const FEED_DESCRIPTION_MAX = 300;

export type RssStory = {
  id: number;
  title: string;
  body: string | null;
  created_at: string;
};

const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

export function escapeXml(value: string): string {
  return value
    .replace(INVALID_XML, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** RFC 822 date, which RSS 2.0 requires for pubDate. */
export function rfc822Date(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toUTCString();
}

export function storyPageUrl(siteUrl: string, id: number): string {
  return `${siteOrigin(siteUrl)}/item/${id}`;
}

function siteOrigin(siteUrl: string): string {
  const url = new URL(siteUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Feed site URL must be http or https.");
  }
  return url.origin;
}

function selfUrl(origin: string, selfPath: string): string {
  if (!selfPath.startsWith("/") || selfPath.startsWith("//") || selfPath.includes("\\")) {
    return `${origin}${RSS_PATH}`;
  }
  return `${origin}${selfPath}`;
}

function shortDescription(body: string | null): string {
  if (!body) return "";
  const plain = body.replace(/\s+/g, " ").trim();
  if (!plain) return "";
  if (plain.length <= FEED_DESCRIPTION_MAX) return plain;
  return `${plain.slice(0, FEED_DESCRIPTION_MAX - 1).trimEnd()}…`;
}

function isStory(story: RssStory): boolean {
  return (
    Number.isInteger(story.id) &&
    story.id > 0 &&
    typeof story.title === "string" &&
    story.title.trim().length > 0 &&
    typeof story.created_at === "string" &&
    rfc822Date(story.created_at) !== null
  );
}

export function buildRssFeed(input: {
  siteUrl: string;
  siteName: string;
  description: string;
  stories: RssStory[];
  selfPath?: string;
  now?: Date;
}): string {
  const origin = siteOrigin(input.siteUrl);
  const selfPath = input.selfPath ?? RSS_PATH;
  const limit = FEED_STORY_LIMIT;
  const seen = new Set<number>();
  const stories = input.stories
    .filter(isStory)
    .sort((a, b) => {
      const byTime = Date.parse(b.created_at) - Date.parse(a.created_at);
      if (byTime !== 0) return byTime;
      return b.id - a.id;
    })
    .filter((story) => {
      if (seen.has(story.id)) return false;
      seen.add(story.id);
      return true;
    })
    .slice(0, limit);

  const newest = stories[0]?.created_at;
  const lastBuild = (newest && rfc822Date(newest)) || (input.now ?? new Date()).toUTCString();

  const items = stories
    .map((story) => {
      const link = storyPageUrl(origin, story.id);
      const description = shortDescription(story.body);
      const lines = [
        "    <item>",
        `      <title>${escapeXml(story.title.trim())}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <pubDate>${rfc822Date(story.created_at)}</pubDate>`,
      ];
      if (description) {
        lines.push(`      <description>${escapeXml(description)}</description>`);
      }
      lines.push("    </item>");
      return lines.join("\n");
    })
    .join("\n");

  const channel = [
    `    <title>${escapeXml(input.siteName)}</title>`,
    `    <link>${escapeXml(origin)}</link>`,
    `    <description>${escapeXml(input.description)}</description>`,
    "    <language>en-us</language>",
    `    <lastBuildDate>${lastBuild}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(selfUrl(origin, selfPath))}" rel="self" type="application/rss+xml"/>`,
    items,
  ]
    .filter((line) => line.length > 0)
    .join("\n");

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`,
    `  <channel>`,
    channel,
    `  </channel>`,
    `</rss>`,
    ``,
  ].join("\n");
}
