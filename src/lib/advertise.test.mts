import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { advertiseEnabled } from "./site.ts";

const advertisePage = readFileSync(new URL("../app/advertise/page.tsx", import.meta.url), "utf8");
const sitemap = readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");
const header = readFileSync(new URL("../components/Header.tsx", import.meta.url), "utf8");
const slot = readFileSync(new URL("../components/AdSlot.tsx", import.meta.url), "utf8");
const sidebar = readFileSync(new URL("../components/AdSidebar.tsx", import.meta.url), "utf8");
const mobile = readFileSync(new URL("../components/MobileAd.tsx", import.meta.url), "utf8");

test("advertise stays hidden unless NEXT_PUBLIC_SHOW_ADVERTISE is exactly true", () => {
  const previous = process.env.NEXT_PUBLIC_SHOW_ADVERTISE;
  try {
    delete process.env.NEXT_PUBLIC_SHOW_ADVERTISE;
    assert.equal(advertiseEnabled(), false);
    process.env.NEXT_PUBLIC_SHOW_ADVERTISE = "";
    assert.equal(advertiseEnabled(), false);
    process.env.NEXT_PUBLIC_SHOW_ADVERTISE = "false";
    assert.equal(advertiseEnabled(), false);
    process.env.NEXT_PUBLIC_SHOW_ADVERTISE = "TRUE";
    assert.equal(advertiseEnabled(), false);
    process.env.NEXT_PUBLIC_SHOW_ADVERTISE = "true";
    assert.equal(advertiseEnabled(), true);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SHOW_ADVERTISE;
    else process.env.NEXT_PUBLIC_SHOW_ADVERTISE = previous;
  }
});

test("the advertise page, sitemap, nav, and empty slots follow the flag", () => {
  assert.match(advertisePage, /createEditablePage\("advertise"\)/);
  assert.match(advertisePage, /if \(!advertiseEnabled\(\)\) notFound\(\)/);
  assert.match(sitemap, /path !== "\/advertise" \|\| advertiseEnabled\(\)/);
  assert.match(header, /showAdvertise \|\| item\.href !== "\/advertise"/);
  assert.match(slot, /if \(!ad && !advertiseEnabled\(\)\) return null/);
  assert.match(slot, /advertiseLink && advertiseEnabled\(\)/);
  assert.match(sidebar, /if \(!showPlaceholders && !top && !tall\) return null/);
  assert.match(mobile, /if \(!ad && !advertiseEnabled\(\)\) return null/);
  assert.match(slot, /SHOW_ADS|adsEnabled\(\)/);
});
