/** How long a story can stay in the homepage vote ranking. */
export const TOP_STORY_MAX_AGE_HOURS = 72;

const TOP_STORY_MAX_AGE_MS = TOP_STORY_MAX_AGE_HOURS * 60 * 60 * 1000;

/** A story posted after this instant is still eligible for the top of the vote ranking. */
export function topStoryCutoff(now = new Date()): string {
  return new Date(now.getTime() - TOP_STORY_MAX_AGE_MS).toISOString();
}

/** True while the story is not yet older than TOP_STORY_MAX_AGE_HOURS. */
export function isFreshTopStory(createdAt: string, now = new Date()): boolean {
  const published = Date.parse(createdAt);
  if (Number.isNaN(published)) return false;
  return published > now.getTime() - TOP_STORY_MAX_AGE_MS;
}

type RankedStory = {
  id: number;
  points: number;
  created_at: string;
};

/**
 * Fresh stories, highest votes first, then older stories below them.
 * `created_at` is when the story went live.
 */
export function compareTopStories(a: RankedStory, b: RankedStory, now = new Date()): number {
  const aFresh = isFreshTopStory(a.created_at, now);
  const bFresh = isFreshTopStory(b.created_at, now);
  if (aFresh !== bFresh) return aFresh ? -1 : 1;
  if (a.points !== b.points) return b.points - a.points;
  const aTime = Date.parse(a.created_at);
  const bTime = Date.parse(b.created_at);
  if (aTime !== bTime) return bTime - aTime;
  return b.id - a.id;
}
