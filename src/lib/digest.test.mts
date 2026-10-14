import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DIGEST_BOT_USERNAME,
  DIGEST_SECTIONS,
  bearerMatches,
  digestPostBody,
  parseDigestDate,
  parseIngestPayload,
} from "./digest.ts";

const migration = readFileSync(
  new URL("../../supabase/migrations/20261013_digest_stories.sql", import.meta.url),
  "utf8"
);
const serviceSource = readFileSync(new URL("./supabase/service.ts", import.meta.url), "utf8");
const routeSource = readFileSync(
  new URL("../app/api/digest/ingest/route.ts", import.meta.url),
  "utf8"
);
const adminPage = readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8");

const story = {
  section: "QUIRKY",
  headline: "Town crowns a new cornhole champion",
  url: "https://example.com/cornhole-champion",
  paper: "Des Moines Register",
  state: "ia",
  synopsis: "A packed gym watched the final bags land.",
};

test("a digest story becomes a non-political post body with paper and state", () => {
  assert.equal(
    digestPostBody("A packed gym watched the final bags land.", "Des Moines Register", "IA"),
    "A packed gym watched the final bags land. — Des Moines Register, IA"
  );
  assert.equal(DIGEST_BOT_USERNAME, "Cornhole News");
  assert.deepEqual(DIGEST_SECTIONS, [
    "QUIRKY",
    "SERIOUS",
    "AROUND THE MIDWEST",
    "NATIONAL PRESS",
  ]);
});

test("ingest payload accepts one date of stories and rejects bad rows", () => {
  const good = parseIngestPayload({ digest_date: "2026-10-13", stories: [story] });
  assert.equal(good.ok, true);
  if (!good.ok) return;
  assert.equal(good.value.digestDate, "2026-10-13");
  assert.equal(good.value.stories[0]?.state, "IA");
  assert.equal(good.value.stories[0]?.section, "QUIRKY");

  assert.equal(parseDigestDate("2026-02-31"), null);
  assert.equal(parseIngestPayload({ digest_date: "10/13/2026", stories: [] }).ok, false);
  assert.equal(
    parseIngestPayload({
      digest_date: "2026-10-13",
      stories: [{ ...story, section: "Sports" }],
    }).ok,
    false
  );
  assert.equal(
    parseIngestPayload({
      digest_date: "2026-10-13",
      stories: [{ ...story, url: "http://example.com/a" }],
    }).ok,
    false
  );
  assert.equal(
    parseIngestPayload({
      digest_date: "2026-10-13",
      stories: [story, { ...story, headline: "Same link again" }],
    }).ok,
    false
  );
  assert.equal(parseIngestPayload([]).ok, false);

  const empty = parseIngestPayload({ digest_date: "2026-10-13", stories: [] });
  assert.equal(empty.ok, true);
});

test("the ingest bearer check requires the full secret", () => {
  assert.equal(bearerMatches("Bearer correct-secret", "correct-secret"), true);
  assert.equal(bearerMatches("bearer correct-secret", "correct-secret"), true);
  assert.equal(bearerMatches("Bearer correct-secret-extra", "correct-secret"), false);
  assert.equal(bearerMatches("Bearer correct", "correct-secret"), false);
  assert.equal(bearerMatches("Basic correct-secret", "correct-secret"), false);
  assert.equal(bearerMatches(null, "correct-secret"), false);
});

test("digest migration is admin-only, pending until publish, and authored by Cornhole News", () => {
  assert.match(migration, /create table if not exists public\.digest_stories/);
  assert.match(migration, /unique \(digest_date, url\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /'QUIRKY', 'SERIOUS', 'AROUND THE MIDWEST', 'NATIONAL PRESS'/);
  assert.match(migration, /status in \('pending', 'published', 'deleted'\)/);
  assert.match(migration, /username = 'Cornhole News'/);
  assert.match(migration, /story\.synopsis \|\| ' — ' \|\| story\.paper \|\| ', ' \|\| story\.state/);
  assert.match(migration, /is_political,\s*created_at/);
  assert.match(migration, /bot_id,\s*false,/);
  assert.match(migration, /new\.status := 'pending'/);
  assert.match(migration, /if not \(select public\.is_admin\(\)\) then/);
  assert.match(
    migration,
    /grant execute on function public\.ingest_digest_stories\(date, jsonb\) to service_role/
  );
  assert.equal(
    /grant execute on function public\.ingest_digest_stories\(date, jsonb\) to (anon|authenticated)/.test(
      migration
    ),
    false
  );
  assert.match(
    migration,
    /grant execute on function public\.publish_digest_stories\(date\) to authenticated/
  );
  assert.equal(
    /grant execute on function public\.publish_digest_stories\(date\) to (anon|service_role)/.test(
      migration
    ),
    false
  );
  assert.match(migration, /revoke all on table public\.digest_stories from public, anon, authenticated/);
  assert.equal(/grant select on table public\.digest_stories to anon/.test(migration), false);

  assert.match(serviceSource, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(serviceSource, /server-only/);
  assert.equal(/NEXT_PUBLIC_SUPABASE_SERVICE/.test(serviceSource), false);
  assert.equal(/NEXT_PUBLIC_.*SERVICE_ROLE/.test(serviceSource), false);

  assert.match(routeSource, /DIGEST_INGEST_SECRET/);
  assert.equal(/NEXT_PUBLIC_DIGEST/.test(routeSource), false);
  assert.match(adminPage, /\/admin\/review/);
});
