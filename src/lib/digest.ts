import { isIP } from "node:net";
import { timingSafeEqual } from "node:crypto";

/** Keep these limits aligned with supabase/migrations/20261013_digest_stories.sql. */
export const DIGEST_SECTIONS = [
  "QUIRKY",
  "SERIOUS",
  "AROUND THE MIDWEST",
  "NATIONAL PRESS",
] as const;

export type DigestSection = (typeof DIGEST_SECTIONS)[number];

export const DIGEST_BOT_USERNAME = "Cornhole News";

export const DIGEST_MIGRATION_PATH = "supabase/migrations/20261013_digest_stories.sql";

export const DIGEST_MIGRATION_HINT =
  "Digest stories are not in the database yet. In Supabase, open the SQL editor and run supabase/migrations/20261013_digest_stories.sql.";

export const DIGEST_BOT_SETUP =
  "Published stories are written by a profile named Cornhole News. Create that user before publishing. The steps are at the top of supabase/migrations/20261013_digest_stories.sql.";

export const DIGEST_MAX_STORIES = 100;
export const DIGEST_MIN_SECRET_LENGTH = 16;

const MAX_HEADLINE = 300;
const MAX_PAPER = 160;
const MAX_SYNOPSIS = 2000;
const MAX_URL = 2000;
const MAX_SECRET_CHARS = 500;

export type IngestStory = {
  section: DigestSection;
  headline: string;
  url: string;
  paper: string;
  state: string;
  synopsis: string;
};

export type IngestPayload = {
  digestDate: string;
  stories: IngestStory[];
};

export function digestPostBody(synopsis: string, paper: string, state: string): string {
  return `${synopsis} — ${paper}, ${state}`;
}

export function parseDigestDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 2000 || year > 2100) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return value;
}

export function formatDigestDate(isoDate: string): string {
  const parsed = parseDigestDate(isoDate);
  if (!parsed) return isoDate;
  const [year, month, day] = parsed.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function isDigestSection(value: string): value is DigestSection {
  return (DIGEST_SECTIONS as readonly string[]).includes(value);
}

function oneLine(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}

function storyError(index: number, message: string): string {
  return `Story ${index} ${message}`;
}

function cleanHttpsUrl(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 12 || trimmed.length > MAX_URL) return null;
  if (/[\u0000-\u001F\u007F\s]/.test(trimmed)) return null;
  if (!trimmed.startsWith("https://")) return null;
  if (/^https:\/\/[^/?#]*@/.test(trimmed)) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;

  const host = parsed.hostname.toLowerCase();
  if (!host.includes(".")) return null;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return null;
  if (isIP(host)) return null;

  return trimmed;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function parseIngestPayload(
  input: unknown
): { ok: true; value: IngestPayload } | { ok: false; error: string } {
  const record = readRecord(input);
  if (!record) {
    return {
      ok: false,
      error: "Send a JSON object with digest_date and stories.",
    };
  }

  const digestDate = parseDigestDate(record.digest_date);
  if (!digestDate) {
    return { ok: false, error: "digest_date must be a real date, YYYY-MM-DD." };
  }

  if (!Array.isArray(record.stories)) {
    return { ok: false, error: "stories must be a list." };
  }

  if (record.stories.length > DIGEST_MAX_STORIES) {
    return { ok: false, error: "Send at most 100 stories at a time." };
  }

  const stories: IngestStory[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < record.stories.length; index += 1) {
    const storyNumber = index + 1;
    const story = readRecord(record.stories[index]);
    if (!story) {
      return { ok: false, error: storyError(storyNumber, "must be an object.") };
    }

    if (
      typeof story.section !== "string" ||
      typeof story.headline !== "string" ||
      typeof story.url !== "string" ||
      typeof story.paper !== "string" ||
      typeof story.state !== "string" ||
      typeof story.synopsis !== "string"
    ) {
      return {
        ok: false,
        error: storyError(
          storyNumber,
          "is missing a headline, link, paper, state, synopsis, or section."
        ),
      };
    }

    const section = story.section.trim();
    if (!isDigestSection(section)) {
      return {
        ok: false,
        error: storyError(storyNumber, "has a section this site does not use."),
      };
    }

    const headline = oneLine(story.headline);
    if (!headline || headline.length > MAX_HEADLINE) {
      return {
        ok: false,
        error: storyError(storyNumber, "needs a headline of 300 characters or fewer."),
      };
    }

    const url = cleanHttpsUrl(story.url);
    if (!url) {
      return {
        ok: false,
        error: storyError(storyNumber, "needs an https link to a public site."),
      };
    }
    if (seen.has(url)) {
      return {
        ok: false,
        error: storyError(storyNumber, "uses a URL that already appears in this digest."),
      };
    }
    seen.add(url);

    const paper = oneLine(story.paper);
    if (!paper || paper.length > MAX_PAPER) {
      return {
        ok: false,
        error: storyError(storyNumber, "needs a paper name of 160 characters or fewer."),
      };
    }

    const state = oneLine(story.state).toUpperCase();
    if (!/^[A-Z]{2}$/.test(state)) {
      return { ok: false, error: storyError(storyNumber, "needs a two-letter state code.") };
    }

    const synopsis = oneLine(story.synopsis);
    if (!synopsis || synopsis.length > MAX_SYNOPSIS) {
      return {
        ok: false,
        error: storyError(storyNumber, "needs a synopsis of 2000 characters or fewer."),
      };
    }

    stories.push({ section, headline, url, paper, state, synopsis });
  }

  return { ok: true, value: { digestDate, stories } };
}

export function bearerMatches(header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) return false;

  const providedBuf = Buffer.from(match[1]);
  const secretBuf = Buffer.from(secret);
  if (
    providedBuf.length > MAX_SECRET_CHARS ||
    secretBuf.length > MAX_SECRET_CHARS ||
    providedBuf.length !== secretBuf.length
  ) {
    timingSafeEqual(secretBuf, secretBuf);
    return false;
  }

  return timingSafeEqual(providedBuf, secretBuf);
}

export function missingDigestSchema(message: string): boolean {
  return /digest_stories|schema cache|does not exist|admin_digest_dates|publish_digest_stories|ingest_digest_stories/i.test(
    message
  );
}
