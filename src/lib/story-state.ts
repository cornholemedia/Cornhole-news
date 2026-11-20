export const MIDWEST_STATES = [
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MO", name: "Missouri" },
  { code: "NE", name: "Nebraska" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "SD", name: "South Dakota" },
  { code: "WI", name: "Wisconsin" },
] as const;

export type MidwestStateCode = (typeof MIDWEST_STATES)[number]["code"];

export function isMidwestState(value: string): value is MidwestStateCode {
  return MIDWEST_STATES.some((state) => state.code === value);
}

export function midwestStateName(code: string): string {
  return MIDWEST_STATES.find((state) => state.code === code)?.name ?? code;
}

export const STORY_STATE_MIGRATION = "supabase/migrations/20261120_story_state.sql";

export const STORY_STATE_MIGRATION_HINT =
  "Story states need a database update. In Supabase, open the SQL editor and run supabase/migrations/20261120_story_state.sql.";

/**
 * posts.state stores one uppercase Midwest code, or null.
 * Null covers a regional story, a story about more than one state, and
 * anything we are not sure about. A future page can use storyStatePath and
 * posts_with_stats.eq("state", code). posts_state_created_idx matches
 * `state = 'MN' order by created_at desc`.
 */
export function storyStatePath(code: MidwestStateCode): string {
  return `/state/${code.toLowerCase()}`;
}

/** Full state name for a stored code. Unknown or empty codes show nothing. */
export function storyStateLabel(code: string | null | undefined): string | null {
  if (!code || !isMidwestState(code)) return null;
  return midwestStateName(code);
}

export function cleanStoryState(
  value: string
): { ok: true; value: MidwestStateCode | null } | { ok: false; error: string } {
  const code = value.trim().toUpperCase();
  if (!code) return { ok: true, value: null };
  if (!isMidwestState(code)) {
    return { ok: false, error: "Choose a Midwest state, or leave it blank." };
  }
  return { ok: true, value: code };
}

export function missingPostStateColumn(message: string): boolean {
  if (/story_state/i.test(message)) return false;
  return /\bstate\b/i.test(message) && /column|schema cache|does not exist/i.test(message);
}

const STRIP_PHRASES = [
  "kansas city",
  "lake michigan",
  "michigan avenue",
  "michigan ave",
  "indiana avenue",
  "indiana ave",
  "ohio river",
  "missouri river",
] as const;

const STATE_PHRASES: readonly { phrase: string; code: MidwestStateCode }[] = [
  { phrase: "north dakota", code: "ND" },
  { phrase: "south dakota", code: "SD" },
  { phrase: "illinois", code: "IL" },
  { phrase: "indiana", code: "IN" },
  { phrase: "iowa", code: "IA" },
  { phrase: "kansas", code: "KS" },
  { phrase: "michigan", code: "MI" },
  { phrase: "minnesota", code: "MN" },
  { phrase: "missouri", code: "MO" },
  { phrase: "nebraska", code: "NE" },
  { phrase: "ohio", code: "OH" },
  { phrase: "wisconsin", code: "WI" },
];

/** Official state sites only. A local newspaper URL is not enough on its own. */
const OFFICIAL_HOSTS: readonly { host: string; code: MidwestStateCode }[] = [
  { host: "illinois.gov", code: "IL" },
  { host: "in.gov", code: "IN" },
  { host: "iowa.gov", code: "IA" },
  { host: "kansas.gov", code: "KS" },
  { host: "michigan.gov", code: "MI" },
  { host: "state.mn.us", code: "MN" },
  { host: "mn.gov", code: "MN" },
  { host: "mo.gov", code: "MO" },
  { host: "nebraska.gov", code: "NE" },
  { host: "nd.gov", code: "ND" },
  { host: "ohio.gov", code: "OH" },
  { host: "sd.gov", code: "SD" },
  { host: "wisconsin.gov", code: "WI" },
  { host: "wi.gov", code: "WI" },
];

const BYLINE_STATE = / — [^—\n]{1,160}, ([A-Z]{2})\s*$/;

export type StoryStateSignal = MidwestStateCode | "multi" | null;

function spaced(value: string): string {
  return ` ${value.toLowerCase().replace(/[^a-z]+/g, " ").trim()} `;
}

/** Full state names in text. Place names that are not the state are removed first. */
export function stateCodesInText(value: string): MidwestStateCode[] {
  let text = spaced(value);
  for (const phrase of STRIP_PHRASES) {
    text = text.split(` ${phrase} `).join(" ");
  }
  const found: MidwestStateCode[] = [];
  for (const { phrase, code } of STATE_PHRASES) {
    const needle = ` ${phrase} `;
    if (text.includes(needle)) {
      found.push(code);
      text = text.split(needle).join(" ");
    }
  }
  return found;
}

function oneCode(codes: MidwestStateCode[]): StoryStateSignal {
  if (codes.length > 1) return "multi";
  return codes[0] ?? null;
}

function officialHostState(host: string): MidwestStateCode | null {
  const normalized = host.toLowerCase().replace(/\.$/, "");
  for (const { host: domain, code } of OFFICIAL_HOSTS) {
    if (normalized === domain || normalized.endsWith(`.${domain}`)) return code;
  }
  return null;
}

function bylineState(body: string): MidwestStateCode | null {
  const match = BYLINE_STATE.exec(body);
  const code = match?.[1];
  return code && isMidwestState(code) ? code : null;
}

/**
 * Best-effort state from a title, URL, and body.
 * Keep this aligned with infer_story_state_for_backfill in
 * supabase/migrations/20261120_story_state.sql.
 * "multi" means more than one Midwest state, which is stored as null.
 * A digest byline is the em dash plus "Paper, ST" at the end of the body.
 */
export function textStoryStateSignal(input: {
  title?: string | null;
  url?: string | null;
  body?: string | null;
}): StoryStateSignal {
  const title = oneCode(stateCodesInText(input.title ?? ""));
  if (title === "multi") return "multi";

  let host: string | null = null;
  let path = "";
  const rawUrl = input.url?.trim();
  if (rawUrl) {
    try {
      const url = new URL(rawUrl);
      host = url.hostname;
      path = url.pathname;
    } catch {
      host = null;
      path = "";
    }
  }

  const pathState = oneCode(stateCodesInText(path));
  if (pathState === "multi") return "multi";

  const signals = new Set<MidwestStateCode>();
  if (title) signals.add(title);
  if (pathState) signals.add(pathState);
  const fromHost = host ? officialHostState(host) : null;
  if (fromHost) signals.add(fromHost);
  const fromByline = bylineState(input.body ?? "");
  if (fromByline) signals.add(fromByline);

  if (signals.size > 1) return "multi";
  return signals.values().next().value ?? null;
}

export function combineStoryStateSignals(
  text: StoryStateSignal,
  digest: StoryStateSignal
): MidwestStateCode | null {
  if (text === "multi" || digest === "multi") return null;
  if (text && digest && text !== digest) return null;
  return text ?? digest ?? null;
}
