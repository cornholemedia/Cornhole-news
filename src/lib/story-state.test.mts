import assert from "node:assert/strict";
import test from "node:test";
import {
  MIDWEST_STATES,
  cleanStoryState,
  combineStoryStateSignals,
  storyStateLabel,
  storyStatePath,
  textStoryStateSignal,
} from "./story-state.ts";

test("a story state is a Midwest code or blank, and the public label is the full name", () => {
  assert.equal(cleanStoryState("").ok && cleanStoryState("").value, null);
  assert.equal(cleanStoryState("  mn ").ok && cleanStoryState("  mn ").value, "MN");
  assert.equal(cleanStoryState("NY").ok, false);
  assert.equal(storyStateLabel("MN"), "Minnesota");
  assert.equal(storyStateLabel("NY"), null);
  assert.equal(storyStateLabel(null), null);
  assert.equal(storyStatePath("MN"), "/state/mn");
  assert.equal(MIDWEST_STATES.length, 12);
});

test("backfill keeps one clear state and leaves mixed or place-name stories empty", () => {
  assert.equal(
    textStoryStateSignal({ title: "Minnesota lawmakers pass a housing bill" }),
    "MN"
  );
  assert.equal(
    textStoryStateSignal({ title: "North Dakota opens a new bridge" }),
    "ND"
  );
  assert.equal(
    textStoryStateSignal({ title: "Iowa and Wisconsin farms watch the river" }),
    "multi"
  );
  assert.equal(textStoryStateSignal({ title: "Kansas City mayor wins another term" }), null);
  assert.equal(
    textStoryStateSignal({ title: "Kansas City, Kansas, repairs its roads" }),
    "KS"
  );
  assert.equal(
    textStoryStateSignal({ title: "Kansas City, Missouri, repairs its roads" }),
    "MO"
  );
  assert.equal(textStoryStateSignal({ title: "Shops along Michigan Avenue reopen" }), null);
  assert.equal(textStoryStateSignal({ title: "Lake Michigan fishing season starts" }), null);
  assert.equal(textStoryStateSignal({ title: "Towns along the Ohio River watch the flood" }), null);
  assert.equal(
    textStoryStateSignal({
      title: "Capitol notes",
      url: "https://www.mn.gov/governor/news",
    }),
    "MN"
  );
  assert.equal(
    textStoryStateSignal({
      title: "A Minnesota project",
      url: "https://www.illinois.gov/news",
    }),
    "multi"
  );
  assert.equal(
    textStoryStateSignal({
      title: "Town crowns a champion",
      body: "A packed gym watched the final bags land. — Des Moines Register, IA",
    }),
    "IA"
  );
  assert.equal(
    textStoryStateSignal({
      title: "National desk",
      body: "Notes from the capital. — Associated Press, NY",
    }),
    null
  );
  assert.equal(
    textStoryStateSignal({
      title: "Wisconsin plant adds a shift",
      body: "The mill will hire this spring. — Chicago Tribune, IL",
    }),
    "multi"
  );
  assert.equal(
    combineStoryStateSignals(
      textStoryStateSignal({ title: "Bridge work begins" }),
      "MN"
    ),
    "MN"
  );
  assert.equal(combineStoryStateSignals("multi", "MN"), null);
  assert.equal(combineStoryStateSignals("IA", "MN"), null);
  assert.equal(combineStoryStateSignals("WI", "WI"), "WI");
});
