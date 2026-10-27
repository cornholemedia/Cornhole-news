import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CANONICAL_SITE_URL } from "./site.ts";
import {
  TWEET_LIMIT,
  TWEET_SITE_URL,
  X_URL_LENGTH,
  cleanTweetDraft,
  digestShareUrl,
  suggestedTweet,
  xIntentUrl,
  xPostLength,
} from "./tweet.ts";

test("X counts every URL as 23 characters and the limit is 280", () => {
  assert.equal(TWEET_LIMIT, 280);
  assert.equal(X_URL_LENGTH, 23);
  assert.equal(TWEET_SITE_URL, CANONICAL_SITE_URL);
  assert.equal(xPostLength("hello"), 5);
  assert.equal(xPostLength("https://example.com/this/is/a/very/long/path"), 23);
  assert.equal(xPostLength("hi https://a.co"), 3 + 23);
  assert.equal(xPostLength("https://example.com."), 24);
  assert.equal(xPostLength("http://a https://example.com"), "http://a ".length + 23);
  assert.equal(xPostLength("see https://t.co/abc and https://b.co"), "see ".length + 23 + " and ".length + 23);
  assert.equal(xPostLength("👍"), 1);
});

test("a stored draft wins, and a missing draft is the headline plus the right link", () => {
  assert.equal(
    digestShareUrl({
      status: "published",
      postId: 42,
      sourceUrl: "https://example.com/story",
    }),
    "https://cornholenews.news/item/42"
  );
  assert.equal(
    digestShareUrl({
      status: "pending",
      postId: null,
      sourceUrl: "https://example.com/story",
    }),
    "https://example.com/story"
  );
  assert.equal(
    digestShareUrl({
      status: "published",
      postId: null,
      sourceUrl: "https://example.com/story",
    }),
    "https://example.com/story"
  );

  assert.equal(
    suggestedTweet(null, "Town crowns a champion", "https://example.com/story"),
    "Town crowns a champion https://example.com/story"
  );
  assert.equal(
    suggestedTweet("  Saved line  ", "Headline", "https://example.com/story"),
    "Saved line"
  );
  assert.equal(suggestedTweet("  ", "Headline", "https://example.com/story"), "Headline https://example.com/story");

  const intent = xIntentUrl("Bags in https://cornholenews.news/item/42");
  assert.equal(
    intent,
    "https://x.com/intent/post?text=Bags%20in%20https%3A%2F%2Fcornholenews.news%2Fitem%2F42"
  );
});

test("tweet drafts trim to 280 characters and reject other control characters", () => {
  assert.deepEqual(cleanTweetDraft("  hi  "), { ok: true, value: "hi" });
  assert.deepEqual(cleanTweetDraft("   "), { ok: true, value: null });
  assert.deepEqual(cleanTweetDraft("a".repeat(280)), { ok: true, value: "a".repeat(280) });
  assert.equal(cleanTweetDraft("a".repeat(281)).ok, false);
  assert.equal(cleanTweetDraft("bad\u0001").ok, false);
  assert.equal(cleanTweetDraft("bad\tbreak").ok, false);
  assert.deepEqual(cleanTweetDraft("Line one\r\nLine two"), { ok: true, value: "Line one\nLine two" });

  const shortUrl = `${"b".repeat(266)} https://a.co`;
  const cleaned = cleanTweetDraft(shortUrl);
  assert.equal(cleaned.ok, true);
  if (cleaned.ok && cleaned.value) {
    assert.equal(Array.from(cleaned.value).length <= 280, true);
    assert.equal(xPostLength(cleaned.value) > 280, true);
  }
});

test("the review card opens X in a new tab without an account connection", () => {
  const field = readFileSync(new URL("../components/TweetDraftField.tsx", import.meta.url), "utf8");
  const review = readFileSync(new URL("../components/DigestReview.tsx", import.meta.url), "utf8");
  const tweetSource = readFileSync(new URL("./tweet.ts", import.meta.url), "utf8");
  assert.match(tweetSource, /https:\/\/x\.com\/intent\/post\?text=/);
  assert.match(field, /rel="noopener"/);
  assert.match(field, /target="_blank"/);
  assert.match(field, /saveDigestTweetDraft/);
  assert.match(field, /onBlur/);
  assert.equal(/api\.x\.com|twitter\.com\/2|Bearer /.test(field), false);
  assert.match(review, /<TweetDraftField/);
});
