import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CONTACT_LIMIT_PER_HOUR,
  JOB_POSTING_LIMIT_PER_HOUR,
  JOB_SUBMIT_LIMIT_PER_HOUR,
  RESUME_BUCKET_MAX_BYTES,
  RESUME_MAX_BYTES,
  cleanEmail,
  isHoneypotTripped,
  isResumeStoragePath,
  parseContactFields,
  resumeMatchesMagic,
  safeResumeFileName,
} from "./form-fields.ts";
import { jobPostingJsonLd, parseJobPostingFields, paySummary } from "./job-board.ts";
import { CONTACT_BODY, PRIVACY_BODY, TERMS_BODY } from "./legal-copy.ts";

const formsMigration = readFileSync(
  new URL("../../supabase/migrations/20261007_forms_and_settings.sql", import.meta.url),
  "utf8"
);
const jobBoardMigration = readFileSync(
  new URL("../../supabase/migrations/20261009_job_postings.sql", import.meta.url),
  "utf8"
);
const legalMigration = readFileSync(
  new URL("../../supabase/migrations/20261007_legal_pages_text.sql", import.meta.url),
  "utf8"
);
const schema = readFileSync(new URL("../../supabase/schema.sql", import.meta.url), "utf8");
const pageContent = readFileSync(new URL("./page-content.ts", import.meta.url), "utf8");
const siteSource = readFileSync(new URL("./site.ts", import.meta.url), "utf8");

test("legal drafts fit the pages table and do not contain the placeholder word", () => {
  for (const body of [PRIVACY_BODY, TERMS_BODY, CONTACT_BODY]) {
    assert.ok(body.length > 0);
    assert.ok(body.length <= 20000);
    assert.equal(/placeholder/i.test(body), false);
  }
  assert.match(PRIVACY_BODY, /October 8, 2026/);
  assert.match(TERMS_BODY, /October 7, 2026/);
  assert.match(TERMS_BODY, /\[DESIGNATED AGENT NAME\]/);
  assert.match(TERMS_BODY, /\[STATE\]/);
  assert.match(PRIVACY_BODY, /\[MAILING ADDRESS\]/);
  assert.ok(legalMigration.includes(TERMS_BODY));
  assert.ok(legalMigration.includes(CONTACT_BODY));
  assert.match(legalMigration, /Job applications/);
  assert.match(legalMigration, /ilike '%PLACEHOLDER%'/);
  assert.ok(schema.includes(PRIVACY_BODY));
  assert.ok(schema.includes(TERMS_BODY));
});

test("fallback copy describes a Midwest news site, not the lawn game", () => {
  const blob = [pageContent, siteSource, PRIVACY_BODY, TERMS_BODY, CONTACT_BODY, schema].join("\n");
  assert.equal(/game of cornhole/i.test(blob), false);
  assert.equal(/cornhole-related/i.test(blob), false);
  assert.equal(/comments about cornhole/i.test(blob), false);
  assert.equal(/backyard/i.test(blob), false);
  assert.equal(/league organizers/i.test(blob), false);
  assert.match(siteSource, /12 Midwestern states/);
  assert.match(PRIVACY_BODY, /12 Midwestern states/);
  assert.match(PRIVACY_BODY, /poster's name and email are not shown/);
  assert.equal(/position you are applying for/i.test(PRIVACY_BODY), false);
  assert.equal(/attached to the application email/i.test(PRIVACY_BODY), false);
  assert.equal(/download link in an application email/i.test(PRIVACY_BODY), false);
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

test("resume paths stay safe and the old application bucket is unchanged", () => {
  const path = "11111111-1111-4111-8111-111111111111/resume.pdf";
  assert.equal(isResumeStoragePath(path), true);
  assert.equal(isResumeStoragePath(`${path.split("/")[0]}/../secret.pdf`), false);
  assert.equal(safeResumeFileName("My Resume!.pdf", "pdf"), "My-Resume.pdf");
  assert.equal(CONTACT_LIMIT_PER_HOUR, 5);
  assert.equal(JOB_SUBMIT_LIMIT_PER_HOUR, 3);
  assert.equal(JOB_POSTING_LIMIT_PER_HOUR, 3);
  assert.equal(RESUME_MAX_BYTES, 4 * 1024 * 1024);
  assert.equal(RESUME_BUCKET_MAX_BYTES, 5 * 1024 * 1024);
  assert.match(formsMigration, /hourly_limit := 5/);
  assert.match(formsMigration, /hourly_limit := 3/);
  assert.match(formsMigration, /5242880/);
  assert.match(formsMigration, /form_recipient_email/);
  assert.match(formsMigration, /create table if not exists public\.job_applications/);
  assert.equal(resumeMatchesMagic("pdf", new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])), true);
  assert.equal(resumeMatchesMagic("pdf", new Uint8Array([0x50, 0x4b, 0x03, 0x04])), false);
});

const validPosting = {
  title: "City reporter",
  companyName: "Prairie Ledger",
  companyWebsite: "https://example.com",
  city: "Des Moines",
  state: "IA",
  workType: "hybrid",
  employmentType: "full_time",
  payMin: "22",
  payMax: "28",
  payPeriod: "hour",
  payNote: "DOE",
  description: "Cover city hall, schools, and local business for a daily Midwest newsroom.",
  applyUrl: "https://example.com/jobs/reporter",
  applyEmail: "",
  posterName: "Ada Lovelace",
  posterEmail: "ada@example.com",
  termsAccepted: true,
};

test("job postings require a Midwest state, a real job confirmation, and an apply method", () => {
  const missingTerms = parseJobPostingFields({ ...validPosting, termsAccepted: false });
  assert.equal(missingTerms.ok, false);

  const outside = parseJobPostingFields({ ...validPosting, state: "CA" });
  assert.equal(outside.ok, false);

  const noApply = parseJobPostingFields({ ...validPosting, applyUrl: "", applyEmail: "" });
  assert.equal(noApply.ok, false);

  const backwardsPay = parseJobPostingFields({ ...validPosting, payMin: "30", payMax: "10" });
  assert.equal(backwardsPay.ok, false);

  const good = parseJobPostingFields(validPosting);
  assert.equal(good.ok, true);
  if (good.ok) {
    assert.equal(good.value.state, "IA");
    assert.equal(good.value.posterEmail, "ada@example.com");
    assert.equal(paySummary(good.value), "$22–$28 hourly. DOE");
  }

  const remote = parseJobPostingFields({
    ...validPosting,
    workType: "remote",
    payMin: "",
    payMax: "",
    payPeriod: "",
    payNote: "Salary depends on experience",
    applyUrl: "",
    applyEmail: "jobs@example.com",
  });
  assert.equal(remote.ok, true);
  if (!remote.ok) return;

  const json = JSON.stringify(
    jobPostingJsonLd(
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: remote.value.title,
        companyName: remote.value.companyName,
        companyWebsite: remote.value.companyWebsite,
        city: remote.value.city,
        state: remote.value.state,
        workType: remote.value.workType,
        employmentType: remote.value.employmentType,
        payMin: remote.value.payMin,
        payMax: remote.value.payMax,
        payPeriod: remote.value.payPeriod,
        payNote: remote.value.payNote,
        description: remote.value.description,
        applyUrl: remote.value.applyUrl,
        applyEmail: remote.value.applyEmail,
        approvedAt: "2026-10-08T12:00:00.000Z",
        expiresAt: "2026-11-07T12:00:00.000Z",
        createdAt: "2026-10-08T12:00:00.000Z",
        updatedAt: "2026-10-08T12:00:00.000Z",
      },
      "https://cornholenews.news/jobs/11111111-1111-4111-8111-111111111111"
    )
  );
  assert.match(json, /JobPosting/);
  assert.match(json, /TELECOMMUTE/);
  assert.equal(json.includes("ada@example.com"), false);
  assert.match(json, /jobs@example.com/);
});

test("job board migration keeps private contact off the public view and keeps old applications", () => {
  assert.match(jobBoardMigration, /p_form = 'job_posting'/);
  assert.match(jobBoardMigration, /hourly_limit := 3/);
  assert.match(jobBoardMigration, /security_invoker = true/);
  assert.match(jobBoardMigration, /create table if not exists public\.job_postings/);
  assert.equal(/drop table[^;]*job_applications/i.test(jobBoardMigration), false);
  assert.equal(/drop table[^;]*resume/i.test(jobBoardMigration), false);
  const view = jobBoardMigration.slice(
    jobBoardMigration.indexOf("create or replace view public.job_postings_public"),
    jobBoardMigration.indexOf("comment on view public.job_postings_public")
  );
  assert.equal(/poster_email/.test(view), false);
  assert.equal(/poster_name/.test(view), false);
  assert.match(jobBoardMigration, /grant execute on function public\.admin_job_postings\(\) to authenticated/);
  assert.equal(
    /grant execute on function public\.admin_job_postings\(\) to anon/.test(jobBoardMigration),
    false
  );
});
