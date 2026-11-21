import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { RSS_FEED_ALIAS_PATH, RSS_FEED_PATH, X_PROFILE_URL } from "./public-links.ts";
import { CANONICAL_SITE_URL } from "./site.ts";
import {
  RSS_FEED_LIMIT,
  RSS_REVALIDATE_SECONDS,
  buildRssFeed,
  prepareFeedItems,
  toFeedItem,
  type RssItem,
} from "./rss.ts";

const feedPostsSource = readFileSync(new URL("./feed-posts.ts", import.meta.url), "utf8");
const publicClientSource = readFileSync(new URL("./supabase/public.ts", import.meta.url), "utf8");
const rssRoute = readFileSync(new URL("../app/rss.xml/route.ts", import.meta.url), "utf8");
const feedRoute = readFileSync(new URL("../app/feed/route.ts", import.meta.url), "utf8");
const responseSource = readFileSync(new URL("./rss-response.ts", import.meta.url), "utf8");
const followSource = readFileSync(new URL("../components/FollowLinks.tsx", import.meta.url), "utf8");
const headerSource = readFileSync(new URL("../components/Header.tsx", import.meta.url), "utf8");
const layoutSource = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const seoSource = readFileSync(new URL("./seo.ts", import.meta.url), "utf8");

const site = CANONICAL_SITE_URL;

function story(id: number, publishedAt: string, title = `Story ${id}`, description: string | null = `About ${id}`): RssItem {
  return { id, title, description, publishedAt };
}

test("the X profile is exactly @_cornhole_", () => {
  assert.equal(X_PROFILE_URL, "https://x.com/_cornhole_");
  assert.equal(new URL(X_PROFILE_URL).hostname, "x.com");
  assert.equal(new URL(X_PROFILE_URL).pathname, "/_cornhole_");
  assert.equal(RSS_FEED_PATH, "/rss.xml");
  assert.equal(RSS_FEED_ALIAS_PATH, "/feed");
});

test("header and footer link the RSS feed and the X profile", () => {
  assert.match(followSource, /href=\{X_PROFILE_URL\}/);
  assert.match(followSource, /href=\{RSS_FEED_PATH\}/);
  assert.match(followSource, /aria-label="Cornhole News on X"/);
  assert.match(followSource, /aria-label="RSS feed"/);
  assert.match(followSource, /target="_blank"/);
  assert.match(followSource, /rel="noopener noreferrer"/);
  assert.doesNotMatch(followSource, /SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY/);
  assert.match(headerSource, /<FollowLinks tone="header" \/>/);
  assert.match(layoutSource, /<FollowLinks tone="footer" \/>/);
});

test("pages advertise the RSS feed in the document head", () => {
  assert.match(seoSource, /application\/rss\+xml/);
  assert.match(seoSource, /url: RSS_FEED_PATH/);
  assert.match(seoSource, /types: rssAlternateTypes\(\)/);
  assert.match(layoutSource, /rssAlternateTypes\(\)/);
  assert.match(seoSource, /\$\{SITE_NAME\} RSS feed/);
});

test("the feed routes are public, cached, and do not use server secrets", () => {
  for (const source of [rssRoute, feedRoute, responseSource, feedPostsSource, publicClientSource]) {
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
    assert.doesNotMatch(source, /RESEND_API_KEY/);
    assert.doesNotMatch(source, /createServiceClient/);
    assert.doesNotMatch(source, /\.from\("digest_stories"\)/);
    assert.doesNotMatch(source, /\.from\("job_postings"\)/);
  }

  assert.match(feedPostsSource, /posts_with_stats/);
  assert.match(feedPostsSource, /createPublicClient/);
  assert.match(publicClientSource, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.match(feedPostsSource, /\.order\("released_at", \{ ascending: false \}\)/);
  assert.equal(RSS_REVALIDATE_SECONDS, 180);
  assert.match(rssRoute, /export const revalidate = RSS_REVALIDATE_SECONDS/);
  assert.match(feedRoute, /export const revalidate = RSS_REVALIDATE_SECONDS/);
  assert.match(responseSource, /application\/rss\+xml/);
});

test("a post row becomes a feed item only when it has an id, title, and date", () => {
  assert.deepEqual(
    toFeedItem({
      id: 12,
      title: "  Town fair  ",
      body: "  Bags on the lawn.  ",
      created_at: "2026-11-19 15:31:32.498817+00",
    }),
    {
      id: 12,
      title: "Town fair",
      description: "Bags on the lawn.",
      publishedAt: "2026-11-19T15:31:32.498Z",
    }
  );

  assert.equal(toFeedItem({ id: 0, title: "Nope", body: null, created_at: "2026-11-19T00:00:00.000Z" }), null);
  assert.equal(toFeedItem({ id: 4, title: "   ", body: "x", created_at: "2026-11-19T00:00:00.000Z" }), null);
  assert.equal(toFeedItem({ id: 4, title: "Ok", body: "   ", created_at: "not-a-date" }), null);
  assert.equal(
    toFeedItem({ id: 4, title: "Ok", body: "   ", created_at: "2026-11-19T00:00:00.000Z" })?.description,
    null
  );
});

test("the feed is RSS 2.0, newest first, capped, and linked to story pages", () => {
  const older = story(1, "2026-01-01T00:00:00.000Z", "Older & smaller");
  const newer = story(9, "2026-11-18T12:00:00.000Z", "Newer <story>", "A & B");
  const blank = story(3, "2026-11-10T00:00:00.000Z", "No blurb", "   ");
  const items = [older, newer, blank, story(9, "2026-11-17T00:00:00.000Z", "Duplicate id")];

  for (let id = 20; id < 20 + RSS_FEED_LIMIT; id += 1) {
    items.push(story(id, `2026-10-${String((id % 28) + 1).padStart(2, "0")}T00:00:00.000Z`));
  }

  const xml = buildRssFeed({
    siteUrl: `${site}/ignored`,
    siteName: "Cornhole News",
    description: "News and discussion for the 12 Midwestern states.",
    items,
    now: new Date("2026-11-19T16:00:00.000Z"),
  });

  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<rss version="2\.0" xmlns:atom="http:\/\/www\.w3\.org\/2005\/Atom">/);
  assert.match(xml, /<title>Cornhole News<\/title>/);
  assert.match(xml, new RegExp(`<link>${site}<\\/link>`));
  assert.match(xml, /<description>News and discussion for the 12 Midwestern states\.<\/description>/);
  assert.match(xml, /<lastBuildDate>Thu, 19 Nov 2026 16:00:00 GMT<\/lastBuildDate>/);
  const selfLink = `${site}${RSS_FEED_PATH}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(xml, new RegExp(`<atom:link href="${selfLink}" rel="self" type="application/rss\\+xml"/>`));

  const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1] ?? "");
  assert.equal(blocks.length, RSS_FEED_LIMIT);

  const ids = blocks.map((block) => {
    const link = block.match(/<link>([^<]+)<\/link>/)?.[1];
    const guid = block.match(/<guid isPermaLink="true">([^<]+)<\/guid>/)?.[1];
    const pubDate = block.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1];
    assert.equal(link, guid);
    assert.match(link ?? "", new RegExp(`^${site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/item/\\d+$`));
    assert.match(pubDate ?? "", /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/);
    return Number(link?.split("/").pop());
  });

  assert.equal(ids[0], 9);
  assert.equal(ids[1], 3);
  assert.ok(!ids.includes(1), "the oldest story falls off the 50-item cap");
  assert.equal(new Set(ids).size, ids.length);

  const newest = blocks[0] ?? "";
  assert.match(newest, /<title>Newer &lt;story&gt;<\/title>/);
  assert.match(newest, new RegExp(`<link>${site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/item/9</link>`));
  assert.match(newest, /<pubDate>Wed, 18 Nov 2026 12:00:00 GMT<\/pubDate>/);
  assert.match(newest, /<description>A &amp; B<\/description>/);
  assert.doesNotMatch(blocks[1] ?? "", /<description>/);

  const escaped = xml.replace(/&(?:amp|lt|gt|quot|apos);/g, "");
  assert.equal(escaped.includes("&"), false);
});

test("prepareFeedItems sorts newest first and drops a bad date", () => {
  const ready = prepareFeedItems([
    story(2, "2026-11-02T00:00:00.000Z"),
    story(5, "not-a-date"),
    story(4, "2026-11-04T00:00:00.000Z"),
  ]);
  assert.deepEqual(
    ready.map((item) => item.id),
    [4, 2]
  );
});
