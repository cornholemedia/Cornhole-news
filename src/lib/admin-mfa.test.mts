import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  adminMfaRedirect,
  adminMfaRequired,
  loginRedirectAfterPassword,
  mfaContinuePath,
  normalizeTotpCode,
  qrImageSrc,
} from "./admin-mfa.ts";

const migration = readFileSync(
  new URL("../../supabase/migrations/20261102_admin_mfa_aal.sql", import.meta.url),
  "utf8"
);
const ingest = readFileSync(new URL("../app/api/digest/ingest/route.ts", import.meta.url), "utf8");
const middleware = readFileSync(new URL("./supabase/middleware.ts", import.meta.url), "utf8");
const reviewPage = readFileSync(new URL("../app/admin/review/page.tsx", import.meta.url), "utf8");
const backToTop = readFileSync(new URL("../components/BackToTop.tsx", import.meta.url), "utf8");

test("ADMIN_REQUIRE_MFA is on only when the value is exactly true", () => {
  const previous = process.env.ADMIN_REQUIRE_MFA;
  try {
    delete process.env.ADMIN_REQUIRE_MFA;
    assert.equal(adminMfaRequired(), false);
    process.env.ADMIN_REQUIRE_MFA = "false";
    assert.equal(adminMfaRequired(), false);
    process.env.ADMIN_REQUIRE_MFA = "TRUE";
    assert.equal(adminMfaRequired(), false);
    process.env.ADMIN_REQUIRE_MFA = "true";
    assert.equal(adminMfaRequired(), true);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_REQUIRE_MFA;
    else process.env.ADMIN_REQUIRE_MFA = previous;
  }
});

test("enrolled admins at aal1 go to the code page, and others are not locked out", () => {
  assert.equal(normalizeTotpCode(" 123 456 "), "123456");
  assert.equal(normalizeTotpCode("12345"), null);
  assert.equal(normalizeTotpCode("12345a"), null);
  assert.equal(qrImageSrc("<svg></svg>")?.startsWith("data:image/svg+xml"), true);
  assert.equal(qrImageSrc("https://example.com/qr.svg"), null);

  assert.equal(
    adminMfaRedirect({
      pathname: "/admin/review",
      currentLevel: "aal1",
      hasVerifiedFactor: true,
      requireEnrollment: false,
      assuranceKnown: true,
    }),
    "/admin/mfa?next=%2Fadmin%2Freview"
  );
  assert.equal(
    adminMfaRedirect({
      pathname: "/admin/mfa",
      search: "?next=%2Fadmin",
      currentLevel: "aal1",
      hasVerifiedFactor: true,
      requireEnrollment: false,
      assuranceKnown: true,
    }),
    null
  );
  assert.equal(
    adminMfaRedirect({
      pathname: "/admin",
      currentLevel: "aal1",
      hasVerifiedFactor: false,
      requireEnrollment: false,
      assuranceKnown: true,
    }),
    null
  );
  assert.equal(
    adminMfaRedirect({
      pathname: "/admin/ads",
      currentLevel: "aal1",
      hasVerifiedFactor: false,
      requireEnrollment: true,
      assuranceKnown: true,
    }),
    "/admin/security"
  );
  assert.equal(
    adminMfaRedirect({
      pathname: "/admin/security",
      currentLevel: "aal1",
      hasVerifiedFactor: false,
      requireEnrollment: true,
      assuranceKnown: true,
    }),
    null
  );
  assert.equal(
    adminMfaRedirect({
      pathname: "/admin/review",
      currentLevel: "aal2",
      hasVerifiedFactor: true,
      requireEnrollment: true,
      assuranceKnown: true,
    }),
    null
  );
  assert.equal(mfaContinuePath("?next=/admin/review"), "/admin/review");
  assert.equal(mfaContinuePath("?next=https://evil.example"), "/admin");

  assert.equal(
    loginRedirectAfterPassword({
      requestedNext: "/admin/review",
      isAdmin: true,
      currentLevel: "aal1",
      hasVerifiedFactor: true,
      requireEnrollment: false,
    }),
    "/admin/mfa?next=%2Fadmin%2Freview"
  );
  assert.equal(
    loginRedirectAfterPassword({
      requestedNext: "/",
      isAdmin: false,
      currentLevel: "aal1",
      hasVerifiedFactor: true,
      requireEnrollment: true,
    }),
    "/"
  );
  assert.equal(
    loginRedirectAfterPassword({
      requestedNext: "/admin",
      isAdmin: true,
      currentLevel: "aal1",
      hasVerifiedFactor: false,
      requireEnrollment: true,
    }),
    "/admin/security"
  );
  assert.equal(
    loginRedirectAfterPassword({
      requestedNext: "/",
      isAdmin: true,
      currentLevel: "aal1",
      hasVerifiedFactor: false,
      requireEnrollment: true,
    }),
    "/"
  );
});

test("the database check requires aal2 only after a verified factor exists", () => {
  assert.match(migration, /auth\.mfa_factors/);
  assert.match(migration, /status = 'verified'/);
  assert.match(migration, /auth\.jwt\(\) ->> 'aal'/);
  assert.match(migration, /not exists/);
  assert.match(migration, /is_admin = true/);
  assert.equal(/DIGEST_INGEST_SECRET|ingest_digest_stories/.test(migration), false);
  assert.equal(/adminMfa|aal2/.test(ingest), false);
  assert.match(middleware, /adminMfaRedirect/);
  assert.match(middleware, /pathname\.startsWith\("\/admin"\)/);
});

test("the review page has a back to top control that stays out of the tweet buttons", () => {
  assert.match(backToTop, /BACK_TO_TOP_AFTER = 400/);
  assert.match(backToTop, /scrollY > BACK_TO_TOP_AFTER/);
  assert.match(backToTop, /behavior: reduce \? "auto" : "smooth"/);
  assert.match(backToTop, /aria-label="Back to top"/);
  assert.match(backToTop, /fixed bottom-4 right-4/);
  assert.match(reviewPage, /<BackToTop \/>/);
  assert.match(reviewPage, /pr-36 pb-20/);
});
