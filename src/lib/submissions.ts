import "server-only";
import { sendSiteEmail } from "@/lib/email";
import {
  FORM_SAVE_ERROR,
  HONEYPOT_FIELD,
  emailSubject,
  fieldValue,
  isHoneypotTripped,
  parseContactFields,
  parseNewsletterFields,
  type FormStatus,
} from "@/lib/form-fields";
import { recordIpAttempt } from "@/lib/rate-limit";
import { requestClientIp, requestIpHash } from "@/lib/request-ip";
import { CONTACT_RECIPIENT_KEY, recipientEmail } from "@/lib/site-settings";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyTurnstileToken, TURNSTILE_FIELD } from "@/lib/turnstile";
import { newsletterUnsubscribeUrl } from "@/lib/unsubscribe";
import { getSiteUrl } from "@/lib/site";

const MISSING_SUPABASE_WARNING =
  "NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. The form submission was not saved.";

type FormClient = NonNullable<ReturnType<typeof createServiceClient>>;

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
  const supabase = createServiceClient();
  if (!supabase) {
    console.error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. The form submission was not saved."
    );
  }
  return supabase;
}

async function assertHuman(formData: FormData): Promise<FormStatus | null> {
  const verified = await verifyTurnstileToken(
    fieldValue(formData.get(TURNSTILE_FIELD)),
    await requestClientIp()
  );
  if (!verified.ok) return verified;
  return null;
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

  const human = await assertHuman(formData);
  if (human) return human;

  const supabase = await formClient();
  if (!supabase) return { ok: false, error: FORM_SAVE_ERROR };

  const ipHash = await requestIpHash();
  const allowed = await recordIpAttempt("contact", ipHash);
  if (!allowed.ok) return allowed;

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
  const unsubscribe = newsletterUnsubscribeUrl(email);
  const lines = [
    "Thanks for subscribing to Cornhole News.",
    "",
    "We'll send Midwest news to this email address. Cornhole News is a community news and discussion site for the 12 Midwestern states.",
    "",
    "If you did not ask for this, you can ignore the message.",
  ];
  if (unsubscribe) {
    lines.push("", `Unsubscribe: ${unsubscribe}`);
  }
  lines.push("", getSiteUrl());

  await sendSiteEmail({
    to: email,
    replyTo: inbox,
    subject: "You're subscribed to Cornhole News",
    text: lines.join("\n"),
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

  const human = await assertHuman(formData);
  if (human) return human;

  const supabase = await formClient();
  if (!supabase) return { ok: false, error: FORM_SAVE_ERROR };

  const ipHash = await requestIpHash();
  const allowed = await recordIpAttempt("newsletter", ipHash);
  if (!allowed.ok) return allowed;

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
