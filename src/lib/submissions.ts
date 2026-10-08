import "server-only";
import { randomUUID } from "node:crypto";
import { sendSiteEmail } from "@/lib/email";
import {
  FORM_RATE_LIMIT_ERROR,
  FORM_SAVE_ERROR,
  HONEYPOT_FIELD,
  RESUME_BUCKET,
  RESUME_FILE_ERROR,
  RESUME_MAX_BYTES,
  RESUME_MIME,
  emailSubject,
  fieldValue,
  isHoneypotTripped,
  isResumeStoragePath,
  parseContactFields,
  parseJobFields,
  parseNewsletterFields,
  resumeKindFromName,
  resumeMatchesMagic,
  safeResumeFileName,
  type FormStatus,
  type ResumeKind,
} from "@/lib/form-fields";
import { requestIpHash } from "@/lib/request-ip";
import { CONTACT_RECIPIENT_KEY, JOBS_RECIPIENT_KEY, recipientEmail } from "@/lib/site-settings";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const MISSING_SUPABASE_WARNING =
  "NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. The form submission was not saved.";

type FormClient = Awaited<ReturnType<typeof createClient>>;

function blank(value: string): string {
  return value.trim() ? value.trim() : "(not provided)";
}

function emailErrorText(error?: string): string | null {
  if (!error) return null;
  const clean = error.replace(/[\r\n]/g, " ").trim().slice(0, 500);
  return clean || null;
}

async function formClient(): Promise<FormClient | null> {
  if (!isSupabaseConfigured()) {
    console.warn(MISSING_SUPABASE_WARNING);
    return null;
  }
  return createClient();
}

async function withinRateLimit(
  supabase: FormClient,
  form: "contact" | "job" | "newsletter",
  ipHash: string | null
): Promise<boolean | null> {
  if (!ipHash) return true;

  const { data, error } = await supabase.rpc("record_form_attempt", {
    p_form: form,
    p_ip_hash: ipHash,
  });

  if (error) {
    console.warn("Could not record a form attempt:", error.message);
    return null;
  }

  return data === true;
}

async function readResumeFile(
  value: FormDataEntryValue | null
): Promise<{ bytes: Uint8Array; kind: ResumeKind; filename: string } | { error: string }> {
  if (!value || typeof value === "string" || typeof value.arrayBuffer !== "function") {
    return { error: RESUME_FILE_ERROR };
  }

  const name = "name" in value && typeof value.name === "string" ? value.name : "";
  const kind = resumeKindFromName(name);
  if (!kind || value.size <= 0 || value.size > RESUME_MAX_BYTES) {
    return { error: RESUME_FILE_ERROR };
  }

  const bytes = new Uint8Array(await value.arrayBuffer());
  if (bytes.byteLength <= 0 || bytes.byteLength > RESUME_MAX_BYTES || !resumeMatchesMagic(kind, bytes)) {
    return { error: RESUME_FILE_ERROR };
  }

  return { bytes, kind, filename: safeResumeFileName(name, kind) };
}

export async function submitContactForm(formData: FormData): Promise<FormStatus> {
  const parsed = parseContactFields({
    name: fieldValue(formData.get("name")),
    email: fieldValue(formData.get("email")),
    subject: fieldValue(formData.get("subject")),
    message: fieldValue(formData.get("message")),
  });
  if (!parsed.ok) return parsed;

  if (isHoneypotTripped(formData.get(HONEYPOT_FIELD))) {
    return { ok: true };
  }

  const supabase = await formClient();
  if (!supabase) return { ok: false, error: FORM_SAVE_ERROR };

  const ipHash = await requestIpHash();
  const allowed = await withinRateLimit(supabase, "contact", ipHash);
  if (allowed === null) return { ok: false, error: FORM_SAVE_ERROR };
  if (!allowed) return { ok: false, error: FORM_RATE_LIMIT_ERROR };

  const { value } = parsed;
  const to = await recipientEmail(CONTACT_RECIPIENT_KEY);
  const sent = await sendSiteEmail({
    to,
    replyTo: value.email,
    subject: emailSubject("Contact form: ", value.subject || value.name),
    text: [
      "New message from the Cornhole News contact form.",
      "",
      `Name: ${value.name}`,
      `Email: ${value.email}`,
      `Subject: ${blank(value.subject)}`,
      "",
      "Message:",
      value.message,
    ].join("\n"),
  });

  const { error } = await supabase.from("contact_submissions").insert({
    name: value.name,
    email: value.email,
    subject: value.subject,
    message: value.message,
    email_sent: sent.sent,
    email_error: sent.sent ? null : emailErrorText(sent.error),
    ip_hash: ipHash,
  });

  if (error) {
    console.error("Could not save contact submission:", error.message);
    return { ok: false, error: FORM_SAVE_ERROR };
  }

  return { ok: true };
}

export async function submitJobForm(formData: FormData): Promise<FormStatus> {
  const parsed = parseJobFields({
    fullName: fieldValue(formData.get("fullName")),
    email: fieldValue(formData.get("email")),
    phone: fieldValue(formData.get("phone")),
    city: fieldValue(formData.get("city")),
    state: fieldValue(formData.get("state")),
    position: fieldValue(formData.get("position")),
    website: fieldValue(formData.get("website")),
    coverLetter: fieldValue(formData.get("coverLetter")),
    heardAbout: fieldValue(formData.get("heardAbout")),
    consent: formData.get("consent") === "on",
  });
  if (!parsed.ok) return parsed;

  if (isHoneypotTripped(formData.get(HONEYPOT_FIELD))) {
    return { ok: true };
  }

  const resume = await readResumeFile(formData.get("resume"));
  if ("error" in resume) return { ok: false, error: resume.error };

  const supabase = await formClient();
  if (!supabase) return { ok: false, error: FORM_SAVE_ERROR };

  const ipHash = await requestIpHash();
  const allowed = await withinRateLimit(supabase, "job", ipHash);
  if (allowed === null) return { ok: false, error: FORM_SAVE_ERROR };
  if (!allowed) return { ok: false, error: FORM_RATE_LIMIT_ERROR };

  const resumePath = `${randomUUID()}/${resume.filename}`;
  if (!isResumeStoragePath(resumePath)) {
    console.error("Refusing an unexpected resume path.");
    return { ok: false, error: FORM_SAVE_ERROR };
  }

  const { error: uploadError } = await supabase.storage.from(RESUME_BUCKET).upload(resumePath, resume.bytes, {
    contentType: RESUME_MIME[resume.kind],
    upsert: false,
  });

  if (uploadError) {
    console.error("Could not store a resume:", uploadError.message);
    return { ok: false, error: FORM_SAVE_ERROR };
  }

  const { value } = parsed;
  const to = await recipientEmail(JOBS_RECIPIENT_KEY);
  const sent = await sendSiteEmail({
    to,
    replyTo: value.email,
    subject: emailSubject("Job application: ", `${value.fullName} - ${value.position}`),
    text: [
      "New job application from the Cornhole News jobs page.",
      "",
      `Name: ${value.fullName}`,
      `Email: ${value.email}`,
      `Phone: ${value.phone}`,
      `City: ${value.city}`,
      `State: ${value.state}`,
      `Position: ${value.position}`,
      `Website: ${blank(value.website)}`,
      `How they heard about us: ${blank(value.heardAbout)}`,
      "Consent to use this application: yes",
      "",
      "Cover letter:",
      value.coverLetter,
      "",
      "The resume is attached to this email.",
      `A backup copy is in the private Supabase Storage bucket "${RESUME_BUCKET}" at:`,
      resumePath,
    ].join("\n"),
    attachments: [
      {
        filename: resume.filename,
        content: Buffer.from(resume.bytes),
        contentType: RESUME_MIME[resume.kind],
      },
    ],
  });

  const { error } = await supabase.from("job_applications").insert({
    full_name: value.fullName,
    email: value.email,
    phone: value.phone,
    city: value.city,
    state: value.state,
    position: value.position,
    website_url: value.website,
    resume_path: resumePath,
    cover_letter: value.coverLetter,
    heard_about: value.heardAbout,
    consent: true,
    email_sent: sent.sent,
    email_error: sent.sent ? null : emailErrorText(sent.error),
    ip_hash: ipHash,
  });

  if (error) {
    console.error("Could not save job application:", error.message);
    return { ok: false, error: FORM_SAVE_ERROR };
  }

  return { ok: true };
}

const NEWSLETTER_SUCCESS = "Thanks. You're subscribed. We'll send Midwest news to that inbox.";
const NEWSLETTER_DUPLICATE =
  "You're already subscribed. We'll keep sending Midwest news to that inbox.";

function isDuplicateSignup(error: { code?: string; message?: string }): boolean {
  return error.code === "23505" || /newsletter_subscribers_email_lower_idx/i.test(error.message ?? "");
}

async function sendNewsletterEmails(email: string, source: string): Promise<void> {
  if (!process.env.RESEND_API_KEY?.trim()) return;

  const inbox = await recipientEmail(CONTACT_RECIPIENT_KEY);
  const page = source || "/";

  await sendSiteEmail({
    to: email,
    replyTo: inbox,
    subject: "You're subscribed to Cornhole News",
    text: [
      "Thanks for subscribing to Cornhole News.",
      "",
      "We'll send Midwest news to this email address. Cornhole News is a community news and discussion site for the 12 Midwestern states.",
      "",
      "If you did not ask for this, you can ignore the message.",
      "",
      "https://cornholenews.news",
    ].join("\n"),
  });

  await sendSiteEmail({
    to: inbox,
    replyTo: email,
    subject: emailSubject("Newsletter signup: ", email),
    text: [
      "New newsletter signup from the Cornhole News footer.",
      "",
      `Email: ${email}`,
      `Page: ${page}`,
    ].join("\n"),
  });
}

export async function submitNewsletterForm(formData: FormData): Promise<FormStatus> {
  const parsed = parseNewsletterFields({
    email: fieldValue(formData.get("email")),
    source: fieldValue(formData.get("source")),
  });
  if (!parsed.ok) return parsed;

  if (isHoneypotTripped(formData.get(HONEYPOT_FIELD))) {
    return { ok: true, message: NEWSLETTER_SUCCESS };
  }

  const supabase = await formClient();
  if (!supabase) return { ok: false, error: FORM_SAVE_ERROR };

  const ipHash = await requestIpHash();
  const allowed = await withinRateLimit(supabase, "newsletter", ipHash);
  if (allowed === null) return { ok: false, error: FORM_SAVE_ERROR };
  if (!allowed) return { ok: false, error: FORM_RATE_LIMIT_ERROR };

  const { value } = parsed;
  const { error } = await supabase.from("newsletter_subscribers").insert({
    email: value.email,
    source: value.source,
    ip_hash: ipHash,
  });

  if (error) {
    if (isDuplicateSignup(error)) {
      return { ok: true, message: NEWSLETTER_DUPLICATE };
    }
    console.error("Could not save newsletter signup:", error.message);
    return { ok: false, error: FORM_SAVE_ERROR };
  }

  try {
    await sendNewsletterEmails(value.email, value.source);
  } catch (emailError) {
    console.warn(
      "Newsletter signup was saved, but the email failed:",
      emailError instanceof Error ? emailError.message : "unknown error"
    );
  }

  return { ok: true, message: NEWSLETTER_SUCCESS };
}
