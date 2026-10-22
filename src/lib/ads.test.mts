import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { AD_PLACEMENTS, parseAdDraft, safeAdClickUrl } from "./ads.ts";

const migration = readFileSync(
  new URL("../../supabase/migrations/20261022_ads.sql", import.meta.url),
  "utf8"
);

test("ad drafts accept a live creative and reject a bad image link", () => {
  const good = parseAdDraft({
    name: "  Harvest banner ",
    placement: "mobile_320x50",
    imageUrl: "https://cdn.example.com/banner.png",
    clickUrl: "https://example.com/harvest",
    altText: "Harvest sale",
    startsAt: "",
    endsAt: "",
    active: true,
  });
  assert.equal(good.ok, true);
  if (!good.ok) return;
  assert.equal(good.value.name, "Harvest banner");
  assert.equal(good.value.placement, "mobile_320x50");
  assert.equal(good.value.active, true);
  assert.equal(good.value.startsAt, null);

  assert.equal(
    parseAdDraft({
      name: "Sidebar",
      placement: "sidebar_300x250",
      imageUrl: "http://cdn.example.com/box.png",
      clickUrl: "https://example.com/box",
      altText: "",
      startsAt: "",
      endsAt: "",
      active: false,
    }).ok,
    false
  );
  assert.equal(safeAdClickUrl("javascript:alert(1)"), null);
  assert.equal(safeAdClickUrl("https://example.com/go"), "https://example.com/go");
  assert.deepEqual(
    AD_PLACEMENTS.map((item) => item.id),
    ["sidebar_300x250", "sidebar_300x600", "mobile_320x50"]
  );
});

test("the ads migration is public-read for live rows and admin-write", () => {
  assert.match(migration, /create table if not exists public\.ads/);
  assert.match(
    migration,
    /placement in \('sidebar_300x250', 'sidebar_300x600', 'mobile_320x50'\)/
  );
  assert.match(migration, /using \(\s*active/);
  assert.match(migration, /starts_at is null or starts_at <= now\(\)/);
  assert.match(migration, /ends_at is null or ends_at > now\(\)/);
  assert.match(migration, /using \(\(select public\.is_admin\(\)\)\)/);
  assert.match(migration, /with check \(\(select public\.is_admin\(\)\)\)/);
  assert.match(migration, /grant select on table public\.ads to anon, authenticated/);
  assert.equal(/grant insert, update, delete on table public\.ads to anon/.test(migration), false);
  assert.match(migration, /order by random\(\)/);
  assert.match(migration, /set impressions = impressions \+ 1/);
  assert.match(migration, /set clicks = clicks \+ 1/);
  assert.match(migration, /'ads',\s*\n\s*'ads',\s*\n\s*true/);
  assert.match(migration, /bucket_id = 'ads'/);
  assert.match(
    migration,
    /grant execute on function public\.increment_ad_impression\(uuid\) to anon, authenticated/
  );
  assert.match(
    migration,
    /grant execute on function public\.record_ad_click\(uuid\) to anon, authenticated/
  );
});
