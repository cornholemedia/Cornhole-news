import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DIGEST_SECTIONS } from "./digest.ts";
import {
  DRIP_SECTION_ORDER,
  chicagoDayBounds,
  compareReviewOrder,
  dripDeadline,
  formatDripMessage,
  formatReleaseLabel,
  missingDripRelease,
  missingReleasedAtColumn,
  planDripRelease,
  type DripExisting,
} from "./drip-schedule.ts";

const migration = readFileSync(
  new URL("../../supabase/migrations/20261121_drip_release.sql", import.meta.url),
  "utf8"
);

const SEVEN_AM = new Date("2026-11-21T13:00:00.000Z");
const TWO_PM = new Date("2026-11-21T20:00:00.000Z");

function keys(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `s${index}`);
}

test("2:00 PM Central follows daylight saving", () => {
  assert.equal(dripDeadline(SEVEN_AM).toISOString(), TWO_PM.toISOString());
  assert.equal(
    dripDeadline(new Date("2026-07-15T12:00:00.000Z")).toISOString(),
    "2026-07-15T19:00:00.000Z"
  );
  const bounds = chicagoDayBounds(SEVEN_AM);
  assert.equal(bounds.start.toISOString(), "2026-11-21T06:00:00.000Z");
  assert.equal(bounds.end.toISOString(), "2026-11-22T06:00:00.000Z");
  assert.ok(SEVEN_AM >= bounds.start && SEVEN_AM < bounds.end);
  assert.ok(new Date("2026-11-21T05:59:59.000Z") < bounds.start);
});

test("a morning batch is evenly spaced and the first story is immediate", () => {
  const incoming = keys(20);
  const plan = planDripRelease({ now: SEVEN_AM, existing: [], incoming });
  assert.equal(plan.length, 20);
  assert.deepEqual(
    plan.map((row) => row.storyKey),
    incoming
  );
  assert.equal(plan[0].publishAt.toISOString(), SEVEN_AM.toISOString());
  assert.equal(plan[19].publishAt.toISOString(), TWO_PM.toISOString());
  const gap = (TWO_PM.getTime() - SEVEN_AM.getTime()) / 19;
  for (let index = 1; index < plan.length; index += 1) {
    const step = plan[index].publishAt.getTime() - plan[index - 1].publishAt.getTime();
    assert.ok(Math.abs(step - gap) <= 1, `gap ${index} was ${step}`);
    assert.ok(plan[index].publishAt <= TWO_PM);
  }
  assert.equal(
    formatDripMessage(
      plan.map((row) => row.publishAt),
      SEVEN_AM
    ),
    "Scheduled 20 stories. The first is on the site now. The last goes live at 2:00 PM CT."
  );
});

test("one story goes live immediately, and after 2 PM the batch does too", () => {
  const one = planDripRelease({ now: SEVEN_AM, existing: [], incoming: ["only"] });
  assert.equal(one[0].publishAt.toISOString(), SEVEN_AM.toISOString());
  assert.equal(formatDripMessage([one[0].publishAt], SEVEN_AM), "Published. It is on the site now.");

  const late = new Date("2026-11-21T21:30:00.000Z");
  const plan = planDripRelease({
    now: late,
    existing: [
      { postId: 1, publishAt: SEVEN_AM },
      { postId: 2, publishAt: new Date("2026-11-21T22:00:00.000Z") },
    ],
    incoming: ["z", "z"],
  });
  assert.equal(plan.some((row) => row.postId === 1), false);
  assert.equal(plan.find((row) => row.postId === 2)?.publishAt.toISOString(), late.toISOString());
  assert.equal(plan.filter((row) => row.storyKey === "z").length, 1);
  assert.equal(plan.find((row) => row.storyKey === "z")?.publishAt.toISOString(), late.toISOString());
  assert.equal(
    formatDripMessage(
      plan.filter((row) => row.storyKey).map((row) => row.publishAt),
      late
    ),
    "Published. It is on the site now."
  );
});

test("clicking through one story at a time still spreads the batch", () => {
  let existing: DripExisting[] = [];
  const first = planDripRelease({ now: SEVEN_AM, existing, incoming: ["a"] });
  existing = [{ postId: 1, publishAt: first[0].publishAt }];

  const secondAt = new Date(SEVEN_AM.getTime() + 5000);
  const second = planDripRelease({ now: secondAt, existing, incoming: ["b"] });
  assert.deepEqual(
    second.map((row) => row.storyKey ?? row.postId),
    ["b"]
  );
  assert.equal(second[0].publishAt.toISOString(), TWO_PM.toISOString());
  existing = [...existing, { postId: 2, publishAt: second[0].publishAt }];

  const thirdAt = new Date(SEVEN_AM.getTime() + 10_000);
  const third = planDripRelease({ now: thirdAt, existing, incoming: ["c"] });
  assert.equal(third.some((row) => row.postId === 1), false);
  assert.equal(third.find((row) => row.postId === 2)?.publishAt.toISOString(), "2026-11-21T16:30:00.000Z");
  assert.equal(third.find((row) => row.storyKey === "c")?.publishAt.toISOString(), TWO_PM.toISOString());
});

test("a later batch leaves live stories put and fills the time that is left", () => {
  const first = planDripRelease({ now: SEVEN_AM, existing: [], incoming: keys(20) });
  const existing = first.map((row, index) => ({ postId: index + 1, publishAt: row.publishAt }));
  const nineAm = new Date("2026-11-21T15:00:00.000Z");
  const frozen = existing.filter((post) => post.publishAt.getTime() <= nineAm.getTime());
  assert.ok(frozen.length >= 5);

  const next = planDripRelease({
    now: nineAm,
    existing,
    incoming: ["n1", "n2", "n3", "n4", "n5"],
  });
  for (const post of frozen) {
    assert.equal(next.some((row) => row.postId === post.postId), false);
  }
  assert.deepEqual(
    next.filter((row) => row.storyKey).map((row) => row.storyKey),
    ["n1", "n2", "n3", "n4", "n5"]
  );
  assert.equal(next[0].publishAt.toISOString(), nineAm.toISOString());
  assert.equal(next[next.length - 1].publishAt.toISOString(), TWO_PM.toISOString());
  assert.ok(next.every((row) => row.publishAt >= nineAm && row.publishAt <= TWO_PM));
  const gap = (TWO_PM.getTime() - nineAm.getTime()) / (next.length - 1);
  for (let index = 1; index < next.length; index += 1) {
    const step = next[index].publishAt.getTime() - next[index - 1].publishAt.getTime();
    assert.ok(Math.abs(step - gap) <= 1);
  }
});

test("review order follows the digest sections", () => {
  assert.deepEqual(DRIP_SECTION_ORDER, DIGEST_SECTIONS);
  const rows = [
    { id: "b", section: "POLITICS", createdAt: "2026-11-21T12:00:00.000Z" },
    { id: "a", section: "QUIRKY", createdAt: "2026-11-21T13:00:00.000Z" },
    { id: "d", section: "QUIRKY", createdAt: "2026-11-21T12:00:00.000Z" },
    { id: "c", section: "OTHER", createdAt: "2026-11-21T11:00:00.000Z" },
  ].sort(compareReviewOrder);
  assert.deepEqual(
    rows.map((row) => row.id),
    ["d", "a", "b", "c"]
  );
});

test("release labels use Central time", () => {
  assert.deepEqual(formatReleaseLabel(null, SEVEN_AM), { label: "Live", scheduled: false });
  assert.deepEqual(formatReleaseLabel(SEVEN_AM.toISOString(), SEVEN_AM), {
    label: "Live",
    scheduled: false,
  });
  assert.deepEqual(formatReleaseLabel("2026-11-21T16:22:00.000Z", SEVEN_AM), {
    label: "Goes live at 10:22 AM CT",
    scheduled: true,
  });
  assert.equal(missingDripRelease("Could not find the function public.apply_drip_schedule in the schema cache"), true);
  assert.equal(missingDripRelease("not allowed"), false);
  assert.equal(missingReleasedAtColumn("column posts_with_stats.released_at does not exist"), true);
  assert.equal(missingReleasedAtColumn("not allowed"), false);
});

test("the migration hides unreleased posts and does not backdate live ones", () => {
  assert.match(migration, /add column if not exists publish_at timestamptz/);
  assert.match(migration, /Existing rows keep publish_at null/);
  assert.equal(migration.includes("set publish_at = created_at"), false);
  assert.match(migration, /p\.publish_at is null or p\.publish_at <= now\(\)/);
  assert.match(migration, /as released_at/);
  assert.match(migration, /security_invoker = true/);
  assert.match(migration, /function public\.apply_drip_schedule/);
  assert.match(migration, /function public\.release_digest_story_now/);
  assert.match(migration, /function public\.unschedule_digest_story/);
  assert.match(migration, /function public\.post_is_public/);
  assert.match(migration, /America\/Chicago/);
  assert.match(migration, /time '14:00'/);
  assert.match(migration, /revoke all on function public\.apply_drip_schedule\(jsonb\) from public, anon, service_role/);
  assert.equal(migration.includes("service_role_key"), false);
  assert.equal(migration.toLowerCase().includes("resend"), false);
});
