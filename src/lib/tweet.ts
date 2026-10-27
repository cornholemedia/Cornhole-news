/** Public story links in suggested tweets. Matches CANONICAL_SITE_URL in site.ts. */
export const TWEET_SITE_URL = "https://cornholenews.news";

/** X's post limit. Every URL in the text counts as this many characters. */
export const TWEET_LIMIT = 280;
export const X_URL_LENGTH = 23;

const URL_PATTERN = /https?:\/\/[^\s]+/gi;
const TRAILING_URL_PUNCTUATION = /[.,!?;:)\]}>"']+$/u;

export function xPostLength(text: string): number {
  let count = 0;
  let cursor = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    const raw = match[0];
    const trimmed = raw.replace(TRAILING_URL_PUNCTUATION, "");
    if (trimmed.length < "https://a".length || !trimmed.includes(".")) continue;

    count += Array.from(text.slice(cursor, start)).length;
    count += X_URL_LENGTH;
    cursor = start + trimmed.length;
  }

  count += Array.from(text.slice(cursor)).length;
  return count;
}

/** Trim a draft. Blank becomes null. Longer than 280 characters is rejected. */
export function cleanTweetDraft(
  value: string
): { ok: true; value: string | null } | { ok: false; error: string } {
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) return { ok: true, value: null };
  // char_length in Postgres counts code points. Tabs and other controls are rejected; newlines stay.
  if (
    Array.from(normalized).length > TWEET_LIMIT ||
    /[\u0000-\u0009\u000B-\u001F\u007F]/.test(normalized)
  ) {
    return { ok: false, error: "A tweet must be 280 characters or fewer." };
  }
  return { ok: true, value: normalized };
}

export function digestShareUrl(options: {
  status: "pending" | "published";
  postId: number | null;
  sourceUrl: string;
}): string {
  if (options.status === "published" && options.postId != null && options.postId > 0) {
    return `${TWEET_SITE_URL}/item/${options.postId}`;
  }
  return options.sourceUrl;
}

export function suggestedTweet(
  draft: string | null | undefined,
  headline: string,
  shareUrl: string
): string {
  const stored = draft?.trim();
  if (stored) return stored;
  return `${headline} ${shareUrl}`;
}

export function xIntentUrl(text: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
}
