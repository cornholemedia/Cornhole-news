import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { X_PROFILE_URL } from "./site.ts";
import {
  FEED_STORY_LIMIT,
  RSS_ALIAS_PATH,
  RSS_PATH,
  buildRssFeed,
  escapeXml,
  rfc822Date,
  storyPageUrl,
  type RssStory,
} from "./rss.ts";

const siteUrl = "https://cornholenews.news";

function story(id: number, created_at: string, extra?: Partial<RssStory>): RssStory {
  return {
    id,
    title: `Story ${id}`,
    body: `Synopsis for story ${id}.`,
    created_at,
    ...extra,
  };
}

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("the X profile is exactly https://x.com/_cornhole_", () => {
  assert.equal(X_PROFILE_URL, "https://x.com/_cornhole_");
  const links = read("../components/FollowLinks.tsx");
  assert.match(links, /href=\{X_PROFILE_URL\}/);
  assert.match(links, /aria-label="Cornhole News on X"/);
  assert.match(links, /target="_blank"/);
  assert.match(links, /rel="noopener noreferrer"/);
  assert.equal(links.includes("https://x.com/cornhole"), false);
  assert.match(read("../components/Header.tsx"), /<FollowLinks variant="header" \/>/);
  assert.match(read("../app/layout.tsx"), /<FollowLinks \/>/);
});

test("pages advertise the RSS feed in the document head", () => {
  const alternate = 'application/rss+xml": [{ url: RSS_PATH, title: RSS_LINK_TITLE }]';
  assert.match(read("./seo.ts"), new RegExp(alternate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(read("../app/layout.tsx"), /application\/rss\+xml/);
  assert.match(read("../app/layout.tsx"), /RSS_PATH/);
  assert.equal(RSS_PATH, "/rss.xml");
  assert.equal(RSS_ALIAS_PATH, "/feed");
});

test("the feed query reads published posts only", () => {
  const feed = read("./feed.ts");
  const query = feed.slice(feed.indexOf("export async function getPublishedFeedStories"));
  const client = read("./supabase/public.ts");
  assert.match(feed, /\.from\("posts_with_stats"\)/);
  assert.match(feed, /\.select\("id, title, body, created_at"\)/);
  assert.match(feed, /\.order\("created_at", \{ ascending: false \}\)/);
  assert.match(feed, /\.limit\(FEED_STORY_LIMIT\)/);
  assert.equal(query.includes("digest_stories"), false);
  assert.equal(query.includes("job_postings"), false);
  assert.equal(feed.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
  assert.equal(feed.includes("RESEND_API_KEY"), false);
  assert.equal(client.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
  assert.match(client, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.equal(FEED_STORY_LIMIT, 50);

  const rssRoute = read("../app/rss.xml/route.ts");
  const aliasRoute = read("../app/feed/route.ts");
  assert.match(rssRoute, /rssFeedResponse\(RSS_PATH\)/);
  assert.match(rssRoute, /export const revalidate = 300/);
  assert.match(aliasRoute, /rssFeedResponse\(RSS_ALIAS_PATH\)/);
  assert.match(read("./feed-response.ts"), /application\/rss\+xml; charset=utf-8/);
});

test("buildRssFeed writes RSS 2.0 with absolute story links, newest first", () => {
  const xml = buildRssFeed({
    siteUrl,
    siteName: "Cornhole News",
    description: "News and discussion for the 12 Midwestern states.",
    selfPath: RSS_PATH,
    now: new Date("2026-11-19T20:00:00.000Z"),
    stories: [
      story(2, "2026-11-18T12:00:00.000Z", { title: "Older & smaller <item>" }),
      story(9, "2026-11-19T15:31:32.498Z", {
        title: "Army plan over Iowa",
        body: "A toxic cloud is expected. — The New York Times, IA",
      }),
      story(4, "2026-11-19T15:31:32.498Z", { body: "   " }),
      story(4, "2026-11-17T00:00:00.000Z", { title: "Duplicate should drop" }),
    ],
  });

  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<rss version="2\.0" xmlns:atom="http:\/\/www\.w3\.org\/2005\/Atom">/);
  assert.match(xml, /<title>Cornhole News<\/title>/);
  assert.match(xml, /<link>https:\/\/cornholenews\.news<\/link>/);
  assert.match(
    xml,
    /<atom:link href="https:\/\/cornholenews\.news\/rss\.xml" rel="self" type="application\/rss\+xml"\/>/
  );

  const links = [...xml.matchAll(/<link>([^<]+)<\/link>/g)].map((match) => match[1]);
  assert.deepEqual(links, [
    "https://cornholenews.news",
    "https://cornholenews.news/item/9",
    "https://cornholenews.news/item/4",
    "https://cornholenews.news/item/2",
  ]);

  const titles = [...xml.matchAll(/<item>\s*<title>([^<]*)<\/title>/g)].map((match) => match[1]);
  assert.deepEqual(titles, [
    "Army plan over Iowa",
    "Story 4",
    escapeXml("Older & smaller <item>"),
  ]);
  assert.match(xml, /<guid isPermaLink="true">https:\/\/cornholenews\.news\/item\/9<\/guid>/);
  assert.equal(rfc822Date("2026-11-19T15:31:32.498Z"), "Thu, 19 Nov 2026 15:31:32 GMT");
  assert.match(xml, /<pubDate>Thu, 19 Nov 2026 15:31:32 GMT<\/pubDate>/);
  assert.match(xml, /<description>A toxic cloud is expected\. — The New York Times, IA<\/description>/);
  assert.equal(xml.includes("Duplicate should drop"), false);
  assert.equal((xml.match(/<item>/g) ?? []).length, 3);

  const blankItem = xml.slice(xml.indexOf("<item>"));
  const secondItem = blankItem.slice(blankItem.indexOf("</item>") + "</item>".length);
  const story4 = secondItem.slice(0, secondItem.indexOf("</item>"));
  assert.equal(story4.includes("<description>"), false);
  assert.equal(storyPageUrl(siteUrl, 9), "https://cornholenews.news/item/9");
});

test("the feed keeps at most the latest 50 stories and skips a blank title", () => {
  const stories = Array.from({ length: 60 }, (_, index) =>
    story(index + 1, new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString())
  );
  stories.push(story(0, "2026-11-19T00:00:00.000Z", { title: "   " }));
  const xml = buildRssFeed({
    siteUrl,
    siteName: "Cornhole News",
    description: "News.",
    stories,
  });
  assert.equal((xml.match(/<item>/g) ?? []).length, 50);
  assert.match(xml, /<link>https:\/\/cornholenews\.news\/item\/60<\/link>/);
  assert.equal(xml.includes("/item/10<"), false);
  assert.equal(xml.includes("/item/1<"), false);
});

test("an alias feed points its self link at /feed", () => {
  const xml = buildRssFeed({
    siteUrl: "https://cornholenews.news/ignored/path",
    siteName: "Cornhole News",
    description: "News & notes",
    selfPath: RSS_ALIAS_PATH,
    stories: [story(8, "2026-11-19T12:00:00.000Z", { body: null })],
  });
  assert.match(xml, /<description>News &amp; notes<\/description>/);
  assert.match(
    xml,
    /<atom:link href="https:\/\/cornholenews\.news\/feed" rel="self" type="application\/rss\+xml"\/>/
  );
  assert.match(xml, /<link>https:\/\/cornholenews\.news\/item\/8<\/link>/);
  assert.equal(xml.includes("<description>Synopsis"), false);
});
