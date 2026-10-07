import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  cleanEmail,
  isHoneypotTripped,
  isResumeStoragePath,
  parseContactFields,
  parseJobFields,
  resumeMatchesMagic,
  safeResumeFileName,
} from "./form-fields.ts";
import { CONTACT_BODY, PRIVACY_BODY, TERMS_BODY } from "./legal-copy.ts";

const legalMigration = readFileSync(
  new URL("../../supabase/migrations/20261007_legal_pages_text.sql", import.meta.url),
  "utf8"
);
const schema = readFileSync(new URL("../../supabase/schema.sql", import.meta.url), "utf8");

test("legal drafts fit the pages table and do not contain the placeholder word", () => {
  for (const body of [PRIVACY_BODY, TERMS_BODY, CONTACT_BODY]) {
    assert.ok(body.length > 0);
    assert.ok(body.length <= 20000);
    assert.equal(/placeholder/i.test(body), false);
  }
  assert.match(PRIVACY_BODY, /October 7, 2026/);
  assert.match(TERMS_BODY, /October 7, 2026/);
  assert.match(TERMS_BODY, /\[DESIGNATED AGENT NAME\]/);
  assert.match(TERMS_BODY, /\[STATE\]/);
  assert.match(PRIVACY_BODY, /\[MAILING ADDRESS\]/);
  assert.ok(legalMigration.includes(PRIVACY_BODY));
  assert.ok(legalMigration.includes(TERMS_BODY));
  assert.ok(legalMigration.includes(CONTACT_BODY));
  assert.match(legalMigration, /ilike '%PLACEHOLDER%'/);
  assert.ok(schema.includes(PRIVACY_BODY));
  assert.ok(schema.includes(TERMS_BODY));
});

test("legal pages use the markdown the site already renders", () => {
  assert.match(PRIVACY_BODY, /^## Children$/m);
  assert.match(PRIVACY_BODY, /\[cornholemedia@gmail.com\]\(mailto:cornholemedia@gmail.com\)/);
  assert.match(TERMS_BODY, /^## Copyright and DMCA$/m);
  assert.match(TERMS_BODY, /^note: /m);
  assert.match(TERMS_BODY, /\[Privacy Policy\]\(\/privacy\)/);
});

test("contact fields reject bad input and keep a normal message", () => {
  assert.equal(cleanEmail("not-an-email"), null);
  assert.equal(cleanEmail("person@example.com"), "person@example.com");
  assert.equal(isHoneypotTripped("  "), false);
  assert.equal(isHoneypotTripped("http://spam.test"), true);

  const good = parseContactFields({
    name: "Ada",
    email: "ada@example.com",
    subject: "",
    message: "Hello from the boards.",
  });
  assert.equal(good.ok, true);

  const bad = parseContactFields({
    name: "Ada",
    email: "ada@example.com",
    subject: "line\nbreak",
    message: "Hello",
  });
  assert.equal(bad.ok, false);
});

test("job fields require consent, a real state, and a safe resume path", () => {
  const path = "11111111-1111-4111-8111-111111111111/resume.pdf";
  assert.equal(isResumeStoragePath(path), true);
  assert.equal(isResumeStoragePath(`${path.split("/")[0]}/../secret.pdf`), false);
  assert.equal(safeResumeFileName("My Resume!.pdf", "pdf"), "My-Resume.pdf");

  const missingConsent = parseJobFields({
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    phone: "515-555-0100",
    city: "Des Moines",
    state: "Iowa",
    position: "Editor",
    website: "",
    coverLetter: "I would like to help.",
    heardAbout: "",
    consent: false,
    resumePath: path,
  });
  assert.equal(missingConsent.ok, false);

  const good = parseJobFields({
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    phone: "515-555-0100",
    city: "Des Moines",
    state: "Iowa",
    position: "Editor",
    website: "https://example.com/ada",
    coverLetter: "I would like to help.",
    heardAbout: "A friend",
    consent: true,
    resumePath: path,
  });
  assert.equal(good.ok, true);
  assert.equal(resumeMatchesMagic("pdf", new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])), true);
  assert.equal(resumeMatchesMagic("pdf", new Uint8Array([0x50, 0x4b, 0x03, 0x04])), false);
});
