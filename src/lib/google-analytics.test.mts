import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PRIVACY_BODY } from "./legal-copy.ts";
import {
  GA_MEASUREMENT_ID_FALLBACK,
  analyticsCollectTargetsAdmin,
  gaMeasurementId,
  isGoogleAnalyticsCollectUrl,
  isTrackedPath,
} from "./google-analytics.ts";

test("measurement id uses the env value and falls back to the public id", () => {
  assert.equal(gaMeasurementId(undefined), GA_MEASUREMENT_ID_FALLBACK);
  assert.equal(gaMeasurementId("  "), GA_MEASUREMENT_ID_FALLBACK);
  assert.equal(gaMeasurementId("G-TEST123"), "G-TEST123");
  assert.equal(GA_MEASUREMENT_ID_FALLBACK, "G-XR4ECDH5BR");
});

test("admin paths are not tracked and public paths are", () => {
  assert.equal(isTrackedPath("/"), true);
  assert.equal(isTrackedPath("/new"), true);
  assert.equal(isTrackedPath("/privacy"), true);
  assert.equal(isTrackedPath("/login"), true);
  assert.equal(isTrackedPath("/administrator"), true);
  assert.equal(isTrackedPath("/admin"), false);
  assert.equal(isTrackedPath("/admin/"), false);
  assert.equal(isTrackedPath("/admin/review"), false);
  assert.equal(isTrackedPath("/admin/pages/privacy"), false);
});

test("collect hits for admin pages are recognized and public hits are kept", () => {
  const collect = "https://www.google-analytics.com/g/collect";
  const script = "https://www.googletagmanager.com/gtag/js?id=G-XR4ECDH5BR";
  assert.equal(isGoogleAnalyticsCollectUrl(script), false);
  assert.equal(isGoogleAnalyticsCollectUrl(collect), true);
  assert.equal(isGoogleAnalyticsCollectUrl("https://region1.google-analytics.com/g/collect"), true);

  const home = `${collect}?v=2&en=page_view&dl=${encodeURIComponent("http://localhost:3000/new")}`;
  const admin = `${collect}?v=2&en=page_view&dl=${encodeURIComponent("http://localhost:3000/admin/review")}`;
  const referrerOnly = `${collect}?v=2&en=page_view&dl=${encodeURIComponent("http://localhost:3000/")}&dr=${encodeURIComponent("http://localhost:3000/admin")}`;

  assert.equal(analyticsCollectTargetsAdmin(home, null), false);
  assert.equal(analyticsCollectTargetsAdmin(admin, null), true);
  assert.equal(analyticsCollectTargetsAdmin(referrerOnly, null), false);
  assert.equal(
    analyticsCollectTargetsAdmin(collect, `en=page_view&dl=${encodeURIComponent("https://cornholenews.news/admin")}`),
    true
  );
  assert.equal(
    analyticsCollectTargetsAdmin(
      `${collect}?dl=${encodeURIComponent("https://cornholenews.news/login?next=/admin")}`,
      null
    ),
    false
  );
});

test("the root layout loads analytics on public pages without reading the request", () => {
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
  const component = readFileSync(new URL("../components/PublicGoogleAnalytics.tsx", import.meta.url), "utf8");

  assert.match(layout, /from "@vercel\/analytics\/next"/);
  assert.match(layout, /<Analytics \/>/);
  assert.match(layout, /<PublicGoogleAnalytics \/>/);
  assert.equal(layout.includes("cookies("), false);
  assert.equal(layout.includes("headers("), false);
  assert.match(component, /from "@next\/third-parties\/google"/);
  assert.match(component, /<GoogleAnalytics gaId=\{gaId\} \/>/);
  assert.match(component, /sendGAEvent\("event", "page_view"/);
  assert.equal(component.includes("cookies("), false);
  assert.equal(component.includes("headers("), false);
  assert.match(proxy, /matcher:\s*\["\/admin", "\/admin\/:path\*"\]/);
  assert.match(PRIVACY_BODY, /Vercel Web Analytics/);
  assert.match(PRIVACY_BODY, /Google Analytics, which uses cookies, to count visits/);
});
