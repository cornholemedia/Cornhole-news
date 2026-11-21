import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { AGGRESSIVE_AI_CRAWLERS } from "./crawler-blocks.ts";
import { HOME_PAGE_MAX, homeHref, parseHomePageParam } from "./home-path.ts";
import { POLITICS_PREFERENCE_SCRIPT } from "./politics-preference.ts";
import { SHOW_POLITICS_COOKIE } from "./show-politics.ts";
import {
  DOCUMENT_REVALIDATE_SECONDS,
  FEED_REVALIDATE_SECONDS,
  SITEMAP_REVALIDATE_SECONDS,
} from "./public-cache.ts";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

function runPreferenceScript(cookie: string, path: string): string | null {
  let replaced: string | null = null;
  const document = { cookie };
  const location = {
    pathname: path,
    replace(url: string) {
      replaced = url;
    },
  };
  const run = new Function("document", "location", POLITICS_PREFERENCE_SCRIPT);
  run(document, location);
  return replaced;
}

test("top pages keep a stable public url", () => {
  assert.equal(HOME_PAGE_MAX, 20);
  assert.equal(homeHref(1, true), "/");
  assert.equal(homeHref(2, true), "/p/2");
  assert.equal(homeHref(1, false), "/no-politics");
  assert.equal(homeHref(4, false), "/no-politics/p/4");
  assert.equal(homeHref(0, true), "/");
  assert.equal(homeHref(500, false), "/no-politics/p/20");
  assert.equal(parseHomePageParam("2"), 2);
  assert.equal(parseHomePageParam("1"), 1);
  assert.equal(parseHomePageParam("01"), null);
  assert.equal(parseHomePageParam("21"), null);
  assert.equal(parseHomePageParam("nope"), null);
});

test("the politics cookie picks the cached top variant before paint", () => {
  assert.match(POLITICS_PREFERENCE_SCRIPT, new RegExp(SHOW_POLITICS_COOKIE));
  assert.equal(runPreferenceScript("", "/"), null);
  assert.equal(runPreferenceScript("show_politics=0", "/"), "/no-politics");
  assert.equal(runPreferenceScript("show_politics=0", "/p/3"), "/no-politics/p/3");
  assert.equal(runPreferenceScript("show_politics=0", "/no-politics"), null);
  assert.equal(runPreferenceScript("show_politics=1", "/no-politics"), "/");
  assert.equal(runPreferenceScript("show_politics=1", "/no-politics/p/2"), "/p/2");
  assert.equal(runPreferenceScript("theme=dark; show_politics=0", "/item/4"), null);
  assert.equal(runPreferenceScript("show_politics=1", "/"), null);
});

test("public pages are cached and the proxy stays on admin", () => {
  assert.equal(FEED_REVALIDATE_SECONDS, 180);
  assert.equal(DOCUMENT_REVALIDATE_SECONDS, 3600);
  assert.equal(SITEMAP_REVALIDATE_SECONDS, 180);

  const proxy = source("../proxy.ts");
  assert.match(proxy, /matcher:\s*\["\/admin", "\/admin\/:path\*"\]/);
  assert.equal(proxy.includes("_next/static"), false);

  for (const file of [
    "../app/page.tsx",
    "../app/new/page.tsx",
    "../app/no-politics/page.tsx",
    "../app/item/[id]/page.tsx",
    "../app/user/[username]/page.tsx",
    "../app/p/[page]/page.tsx",
    "../app/no-politics/p/[page]/page.tsx",
  ]) {
    const page = source(file);
    assert.match(page, /export const revalidate = 180/);
    assert.equal(page.includes("revalidate = 0"), false);
    assert.equal(page.includes("cookies("), false);
    assert.equal(page.includes("headers("), false);
  }

  for (const file of ["../app/page.tsx", "../app/new/page.tsx", "../app/no-politics/page.tsx"]) {
    assert.equal(source(file).includes("searchParams"), false);
  }

  assert.match(source("../app/sitemap.ts"), /SITEMAP_REVALIDATE_SECONDS/);
  assert.equal(source("../app/sitemap.ts").includes("force-dynamic"), false);
  assert.equal(source("./announcement-public.ts").includes("connection("), false);
  assert.equal(source("./ads-public.ts").includes("connection("), false);
  assert.equal(source("./posts.ts").includes("cookies("), false);
  assert.match(source("../components/AnnouncementBanner.tsx"), /announcement-public/);
  assert.match(source("../components/AdSidebar.tsx"), /ads-public/);
});

test("robots and the edge deny list name the same aggressive crawlers", () => {
  const robots = source("../app/robots.ts");
  const firewall = source("../../vercel.json");
  assert.match(robots, /AGGRESSIVE_AI_CRAWLERS/);
  assert.match(robots, /"\/admin"/);
  assert.match(firewall, /"action": "deny"/);
  for (const name of AGGRESSIVE_AI_CRAWLERS) {
    assert.match(firewall, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.equal((AGGRESSIVE_AI_CRAWLERS as readonly string[]).includes("Googlebot"), false);
  assert.equal(firewall.includes("Googlebot"), false);
});
