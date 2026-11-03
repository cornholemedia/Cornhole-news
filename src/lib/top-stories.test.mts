import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  TOP_STORY_MAX_AGE_HOURS,
  compareTopStories,
  isFreshTopStory,
  topStoryCutoff,
} from "./top-stories.ts";

const postsSource = readFileSync(new URL("./posts.ts", import.meta.url), "utf8");
const now = new Date("2026-11-03T15:00:00.000Z");

function story(id: number, points: number, created_at: string) {
  return { id, points, created_at };
}

test("the homepage vote ranking keeps a story on top for 72 hours", () => {
  assert.equal(TOP_STORY_MAX_AGE_HOURS, 72);
  assert.equal(topStoryCutoff(now), "2026-10-31T15:00:00.000Z");
  assert.equal(isFreshTopStory("2026-11-03T14:00:00.000Z", now), true);
  assert.equal(isFreshTopStory("2026-10-31T15:00:00.001Z", now), true);
  assert.equal(isFreshTopStory("2026-10-31T15:00:00.000Z", now), false);
  assert.equal(isFreshTopStory("2026-10-30T15:00:00.000Z", now), false);

  const ranked = [
    story(1, 500, "2026-10-01T00:00:00.000Z"),
    story(2, 2, "2026-11-03T12:00:00.000Z"),
    story(3, 9, "2026-11-02T12:00:00.000Z"),
    story(4, 40, "2026-10-31T14:00:00.000Z"),
  ].sort((a, b) => compareTopStories(a, b, now));

  assert.deepEqual(
    ranked.map((item) => item.id),
    [3, 2, 1, 4]
  );
});

test("only the Top feed applies the age cap", () => {
  const top = postsSource.slice(postsSource.indexOf("export async function getTopPosts"));
  const newer = postsSource.slice(postsSource.indexOf("export async function getNewPosts"));
  assert.match(top, /topStoryCutoff\(\)/);
  assert.match(top, /\.gt\("created_at", cutoff\)/);
  assert.match(top, /\.lte\("created_at", cutoff\)/);
  assert.equal(newer.includes("topStoryCutoff"), false);
  assert.equal(postsSource.includes("getPostById") && postsSource.includes('.eq("id", id)'), true);
});
