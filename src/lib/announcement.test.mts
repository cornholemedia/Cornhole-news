import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isAnnouncementLink, parseAnnouncement } from "./announcement.ts";
import { reviewStoryCollapsed } from "./review-card.ts";
import { publicMerchHref } from "./site.ts";

const migration = readFileSync(
  new URL("../../supabase/migrations/20261104_site_announcement.sql", import.meta.url),
  "utf8"
);
const header = readFileSync(new URL("../components/Header.tsx", import.meta.url), "utf8");
const review = readFileSync(new URL("../components/DigestReview.tsx", import.meta.url), "utf8");
const actions = readFileSync(new URL("../app/admin/announcement/actions.ts", import.meta.url), "utf8");

test("an announcement is short text with an optional site or https link", () => {
  const off = parseAnnouncement({ body: "  ", linkUrl: "", active: false });
  assert.equal(off.ok, true);
  if (off.ok) assert.deepEqual(off.value, { body: "", linkUrl: null, active: false });

  const on = parseAnnouncement({
    body: "  Bags this weekend  ",
    linkUrl: "https://example.com/sale",
    active: true,
  });
  assert.equal(on.ok, true);
  if (on.ok) assert.equal(on.value.body, "Bags this weekend");

  assert.equal(parseAnnouncement({ body: "", linkUrl: "", active: true }).ok, false);
  assert.equal(parseAnnouncement({ body: "Hi", linkUrl: "javascript:alert(1)", active: true }).ok, false);
  assert.equal(isAnnouncementLink("/jobs"), true);
  assert.equal(isAnnouncementLink("//evil.example"), false);
  assert.match(migration, /using \(active = true and char_length\(body\) >= 1\)/);
  assert.match(migration, /using \(\(select public\.is_admin\(\)\)\)/);
  assert.match(actions, /adminClient/);
  assert.match(actions, /revalidatePath\("\/", "layout"\)/);
});

test("published review cards stay collapsed until expanded", () => {
  assert.equal(reviewStoryCollapsed("published", false), true);
  assert.equal(reviewStoryCollapsed("published", true), false);
  assert.equal(reviewStoryCollapsed("pending", false), false);
  assert.match(review, /reviewStoryCollapsed/);
  assert.match(review, /Published/);
  assert.match(review, /Expand/);
  assert.match(review, /actionName === "publish"/);
});

test("Merch is omitted unless the flag is exactly true and the URL is http(s)", () => {
  const show = process.env.NEXT_PUBLIC_SHOW_MERCH;
  const url = process.env.NEXT_PUBLIC_MERCH_URL;
  try {
    delete process.env.NEXT_PUBLIC_SHOW_MERCH;
    delete process.env.NEXT_PUBLIC_MERCH_URL;
    assert.equal(publicMerchHref(), null);
    process.env.NEXT_PUBLIC_SHOW_MERCH = "true";
    process.env.NEXT_PUBLIC_MERCH_URL = "https://shop.example/bags";
    assert.equal(publicMerchHref(), "https://shop.example/bags");
    process.env.NEXT_PUBLIC_SHOW_MERCH = "false";
    assert.equal(publicMerchHref(), null);
    process.env.NEXT_PUBLIC_SHOW_MERCH = "true";
    process.env.NEXT_PUBLIC_MERCH_URL = "javascript:alert(1)";
    assert.equal(publicMerchHref(), null);
  } finally {
    if (show === undefined) delete process.env.NEXT_PUBLIC_SHOW_MERCH;
    else process.env.NEXT_PUBLIC_SHOW_MERCH = show;
    if (url === undefined) delete process.env.NEXT_PUBLIC_MERCH_URL;
    else process.env.NEXT_PUBLIC_MERCH_URL = url;
  }
  assert.match(header, /if \(merchHref\)/);
  assert.match(header, /label: "Merch"/);
});
