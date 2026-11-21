/** Release window for the morning digest. Central time, including daylight saving. */
export const DRIP_TIME_ZONE = "America/Chicago";

/** 2:00 PM. The last story in a batch is due at this hour, or before it. */
export const DRIP_DEADLINE_HOUR = 14;

type CivilTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function civilParts(date: Date, timeZone: string): CivilTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  let hour = pick("hour");
  // Some engines report midnight as 24.
  if (hour === 24) hour = 0;
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour,
    minute: pick("minute"),
    second: pick("second"),
  };
}

function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts = civilParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return asUtc - date.getTime();
}

/** A clock time in America/Chicago, as a UTC instant. */
export function chicagoCivilToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
  second = 0
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const first = zoneOffsetMs(guess, DRIP_TIME_ZONE);
  let result = new Date(guess.getTime() - first);
  const secondOffset = zoneOffsetMs(result, DRIP_TIME_ZONE);
  if (secondOffset !== first) result = new Date(guess.getTime() - secondOffset);
  return result;
}

/** 2:00:00 PM America/Chicago on the same Chicago calendar day as `now`. */
export function dripDeadline(now: Date): Date {
  const parts = civilParts(now, DRIP_TIME_ZONE);
  return chicagoCivilToUtc(parts.year, parts.month, parts.day, DRIP_DEADLINE_HOUR, 0, 0);
}

/** Midnight-to-midnight bounds for the Chicago calendar day of `now`. End is exclusive. */
export function chicagoDayBounds(now: Date): { start: Date; end: Date } {
  const parts = civilParts(now, DRIP_TIME_ZONE);
  const start = chicagoCivilToUtc(parts.year, parts.month, parts.day, 0, 0, 0);
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  return {
    start,
    end: chicagoCivilToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, 0, 0),
  };
}

export function formatCentralClock(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: DRIP_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function chicagoDateKey(date: Date): string {
  const parts = civilParts(date, DRIP_TIME_ZONE);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

/** Label for the review page. Null or a past time means the story is already public. */
export function formatReleaseLabel(
  publishAt: string | null,
  now: Date
): { label: string; scheduled: boolean } {
  if (!publishAt) return { label: "Live", scheduled: false };
  const date = new Date(publishAt);
  if (Number.isNaN(date.getTime()) || date.getTime() <= now.getTime()) {
    return { label: "Live", scheduled: false };
  }
  const clock = formatCentralClock(date);
  const when = chicagoDateKey(date) === chicagoDateKey(now) ? clock : `${clock} ${chicagoDateKey(date)}`;
  return { label: `Goes live at ${when} CT`, scheduled: true };
}

/**
 * Same order as DIGEST_SECTIONS in digest.ts. The test locks the two lists
 * together. Review order is the release order for a batch.
 */
export const DRIP_SECTION_ORDER = [
  "QUIRKY",
  "SERIOUS",
  "POLITICS",
  "AROUND THE MIDWEST",
  "NATIONAL PRESS",
  "TRADE & INDUSTRY",
] as const;

/**
 * How a publish batch is spaced. Keep this aligned with
 * supabase/migrations/20261121_drip_release.sql, which applies the times.
 *
 * Order is the review page order: section, then the time the digest row was
 * saved, then id. Later approvals are appended after stories that are still
 * waiting. They are not mixed back into an earlier section.
 *
 * Already-live stories (publish_at at or before now) stay put.
 * Waiting stories keep their relative order and may move so the remaining
 * set stays evenly spaced. The first story of a fresh batch goes live now.
 * The last lands on 2:00 PM America/Chicago when the window is still open.
 * At or after 2:00 PM, every story in the batch goes live immediately, and
 * any story from today that is still waiting is released too.
 *
 * A second approval while the first batch is still running keeps the original
 * start time when that still leaves every waiting story in the future. If the
 * tighter spacing would pull a waiting story into the past, the waiting
 * stories and the new ones are spaced from now until 2:00 PM instead. The
 * earliest of that remaining set goes live now.
 */

export type DripExisting = {
  postId: number;
  publishAt: Date;
};

export type DripAssignment = {
  postId: number | null;
  storyKey: string | null;
  publishAt: Date;
};

export type ReviewSortable = {
  id: string;
  section: string;
  createdAt: string;
};

const SECTION_RANK = new Map<string, number>(
  DRIP_SECTION_ORDER.map((section, index) => [section, index])
);

export function compareReviewOrder(a: ReviewSortable, b: ReviewSortable): number {
  const rankA = SECTION_RANK.get(a.section) ?? DRIP_SECTION_ORDER.length + 1;
  const rankB = SECTION_RANK.get(b.section) ?? DRIP_SECTION_ORDER.length + 1;
  if (rankA !== rankB) return rankA - rankB;
  const timeA = Date.parse(a.createdAt);
  const timeB = Date.parse(b.createdAt);
  if (timeA !== timeB) return timeA - timeB;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

function byExisting(a: DripExisting, b: DripExisting): number {
  const byTime = a.publishAt.getTime() - b.publishAt.getTime();
  if (byTime !== 0) return byTime;
  return a.postId - b.postId;
}

/** Index 0 is `start`, the last index is `end`, and the gaps are equal. */
export function evenSlots(startMs: number, endMs: number, count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [startMs];
  const span = endMs - startMs;
  const slots: number[] = [];
  for (let index = 0; index < count; index += 1) {
    if (index === 0) slots.push(startMs);
    else if (index === count - 1) slots.push(endMs);
    else slots.push(startMs + Math.round((index * span) / (count - 1)));
  }
  return slots;
}

function assignment(postId: number | null, storyKey: string | null, publishAtMs: number): DripAssignment {
  return { postId, storyKey, publishAt: new Date(publishAtMs) };
}

export function planDripRelease(input: {
  now: Date;
  existing: readonly DripExisting[];
  incoming: readonly string[];
}): DripAssignment[] {
  const nowMs = input.now.getTime();
  const deadlineMs = dripDeadline(input.now).getTime();

  const seenKeys = new Set<string>();
  const incoming: string[] = [];
  for (const key of input.incoming) {
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);
    incoming.push(key);
  }
  if (incoming.length === 0) return [];

  const seenPosts = new Set<number>();
  const existing: DripExisting[] = [];
  for (const post of [...input.existing].sort(byExisting)) {
    if (!Number.isInteger(post.postId) || post.postId <= 0) continue;
    if (Number.isNaN(post.publishAt.getTime())) continue;
    if (seenPosts.has(post.postId)) continue;
    seenPosts.add(post.postId);
    existing.push(post);
  }

  const waiting = existing.filter((post) => post.publishAt.getTime() > nowMs);

  if (nowMs >= deadlineMs) {
    return [
      ...waiting.map((post) => assignment(post.postId, null, nowMs)),
      ...incoming.map((storyKey) => assignment(null, storyKey, nowMs)),
    ];
  }

  const count = existing.length + incoming.length;
  if (count === 1) return [assignment(null, incoming[0], nowMs)];

  const anchorMs = existing.length > 0 ? existing[0].publishAt.getTime() : nowMs;
  const fullSlots = anchorMs < deadlineMs ? evenSlots(anchorMs, deadlineMs, count) : null;
  const bumpsWaiting = fullSlots
    ? existing.some(
        (post, index) => post.publishAt.getTime() > nowMs && fullSlots[index] <= nowMs
      )
    : true;

  if (fullSlots && !bumpsWaiting) {
    const planned: DripAssignment[] = [];
    existing.forEach((post, index) => {
      if (post.publishAt.getTime() <= nowMs) return;
      planned.push(assignment(post.postId, null, fullSlots[index]));
    });
    incoming.forEach((storyKey, offset) => {
      planned.push(assignment(null, storyKey, fullSlots[existing.length + offset]));
    });
    return planned;
  }

  const remain = evenSlots(nowMs, deadlineMs, waiting.length + incoming.length);
  const planned: DripAssignment[] = [];
  waiting.forEach((post, index) => {
    planned.push(assignment(post.postId, null, remain[index]));
  });
  incoming.forEach((storyKey, offset) => {
    planned.push(assignment(null, storyKey, remain[waiting.length + offset]));
  });
  return planned;
}

export function formatDripMessage(publishAts: readonly Date[], now: Date): string {
  const times = publishAts
    .filter((date) => !Number.isNaN(date.getTime()))
    .slice()
    .sort((a, b) => a.getTime() - b.getTime());
  const count = times.length;
  if (count === 0) return "Already published.";

  const first = times[0];
  const last = times[count - 1];
  const firstLive = first.getTime() <= now.getTime();
  const lastLive = last.getTime() <= now.getTime();
  const lastClock = formatCentralClock(last);
  const firstClock = formatCentralClock(first);

  if (count === 1 && firstLive) return "Published. It is on the site now.";
  if (count === 1) return `Scheduled. It goes live at ${firstClock} CT.`;
  if (lastLive) return `Published ${count} stories. They are on the site now.`;
  if (firstLive) {
    return `Scheduled ${count} stories. The first is on the site now. The last goes live at ${lastClock} CT.`;
  }
  return `Scheduled ${count} stories. The first goes live at ${firstClock} CT. The last goes live at ${lastClock} CT.`;
}

export function missingDripRelease(message: string): boolean {
  return (
    /publish_at|released_at|apply_drip_schedule|release_digest_story_now|unschedule_digest_story|post_is_public/i.test(
      message
    ) && /column|schema cache|does not exist|function|could not find/i.test(message)
  );
}
