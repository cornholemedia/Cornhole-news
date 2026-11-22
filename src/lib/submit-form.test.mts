import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/submit/page.tsx", import.meta.url), "utf8");
const titleRoute = readFileSync(new URL("../app/api/fetch-title/route.ts", import.meta.url), "utf8");

test("submit reads the form before awaiting, and a failure clears the spinner", () => {
  const handler = page.slice(page.indexOf("async function handleSubmit"));
  const formAt = handler.indexOf("new FormData(");
  const userAt = handler.indexOf(".getUser(");
  assert.ok(formAt > 0);
  assert.ok(userAt > formAt);
  assert.match(handler, /finally\s*\{[\s\S]*setLoading\(false\)/);
  assert.match(handler, /The submission took too long/);
});

test("title fetch keeps its timeout armed while the article body is read", () => {
  const readAt = titleRoute.indexOf("readResponseText(");
  const clearAt = titleRoute.indexOf("clearTimeout(timer)");
  assert.ok(readAt > 0);
  assert.ok(clearAt > readAt);
  assert.match(titleRoute, /Timed out fetching that URL/);
});
