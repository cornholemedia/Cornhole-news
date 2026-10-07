import "server-only";
import { randomUUID } from "node:crypto";
import { sendSiteEmail } from "@/lib/email";
import {
  CONTACT_LIMIT_PER_HOUR,
  FORM_RATE_LIMIT_ERROR,
  FORM_SAVE_ERROR,
  HONEYPOT_FIELD,
  JOB_SUBMIT_LIMIT_PER_HOUR,
  JOB_UPLOAD_LIMIT_PER_HOUR,
  RESUME_BUCKET,
  RESUME_FILE_ERROR,
  RESUME_LINK_SECONDS,
  RESUME_MAX_BYTES,
  RESUME_MIME,
  emailSubject,
  fieldValue,
  isHoneypotTripped,
  isResumeStoragePath,
  parseContactFields,
  parseJobFields,
  resumeKindFromName,
  resumeMatchesMagic,
  safeResumeFileName,
  type FormStatus,
  type ResumeKind,
} from "@/lib/form-fields";
import { requestIpHash } from "@/lib/request-ip";
import { CONTACT_RECIPIENT_KEY, JOBS_RECIPIENT_KEY, recipientEmail } from "@/lib/site-settings";
import { createServiceClient } from "@/lib/supabase/service";

const HOUR_MS = 60 * 60 * 1000;
const ATTEMPT_RETENTION_MS = 2 * 24 * HOUR_MS;
const UPLOAD_TICKET_MS = 2 * HOUR_MS;

type ServiceClient = NonNullable<ReturnType<typeof createServiceClient>>;

export type ResumeTicketResult =
  | { ok: true; skipped: true }
  | { ok: true; skipped: false; path: string; token: string }
  | { ok: false; error: string };

function serviceClientOrNull(): ServiceClient | null {
  const supabase = createServiceClient();
  if (!supabase) {
    console.warn(
      "SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL is not set. The form submission was not saved."
    );
  }
  return supabase;
}

async function countSince(
  supabase: ServiceClient,
  table: "form_attempts" | "resume_uploads",
  column: "form" | "ip_hash",
  columnValue: string,
  ipHash: string,
  since: string
): Promise<number | null> {
  let query = supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);

  if (column === "form") {
    query = query.eq("form", columnValue);
  }

  const { count, error } = await query;
  if (error) {
    console.warn(`Could not check ${table} rate limit:`, error.message);
    return null;
  }
  return count ?? 0;
}

async function pruneOldAttempts(supabase: ServiceClient) {
  const cutoff = new Date(Date.now() - ATTEMPT_RETENTION_MS).toISOString();
  const { error } = await supabase.from("form_attempts").delete().lt("created_at", cutoff);
  if (error) console.warn("Could not prune form attempts:", error.message);
}

async function recordAttempt(supabase: ServiceClient, form: "contact" | "job", ipHash: string | null) {
  if (!ipHash) return;
  const { error } = await supabase.from("form_attempts").insert({ form, ip_hash: ipHash });
  if (error) console.warn("Could not record a form attempt:", error.message);
}

async function overAttemptLimit(
  supabase: ServiceClient,
  form: "contact" | "job",
  ipHash: string | null,
  limit: number
) {
  if (!ipHash) return false;
  await pruneOldAttempts(supabase);
  const since = new Date(Date.now() - HOUR_MS).toISOString();
  const count = await countSince(supabase, "form_attempts", "form", form, ipHash, since);
  return count !== null && count >= limit;
}

function blank(value: string): string {
  return value.trim() ? value.trim() : "(not provided)";
}

async function markEmailResult(
  supabase: ServiceClient,
  table: "contact_submissions" | "job_applications",
  id: string,
  result: { sent: boolean; error?: string }
) {
  const { error } = await supabase
    .from(table)
    .update({
      email_sent: result.sent,
      email_error: result.sent ? null : (result.error ?? "not_sent").replace(/[\r\n]/g, " ").slice(0, 500),
    })
    .eq("id", id);

  if (error) console.warn(`Could not record email status on ${table}:`, error.message);
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

  const supabase = serviceClientOrNull();
  if (!supabase) return { ok: false, error: FORM_SAVE_ERROR };

  const ipHash = await requestIpHash();
  if (await overAttemptLimit(supabase, "contact", ipHash, CONTACT_LIMIT_PER_HOUR)) {
    return { ok: false, error: FORM_RATE_LIMIT_ERROR };
  }

  await recordAttempt(supabase, "contact", ipHash);
  const recipientPromise = recipientEmail(CONTACT_RECIPIENT_KEY);
  const { value } = parsed;
  const { data, error } = await supabase
    .from("contact_submissions")
    .insert({
      name: value.name,
      email: value.email,
      subject: value.subject,
      message: value.message,
      ip_hash: ipHash,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    console.error("Could not save contact submission:", error?.message ?? "no id");
    return { ok: false, error: FORM_SAVE_ERROR };
  }

  const to = await recipientPromise;
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

  await markEmailResult(supabase, "contact_submissions", data.id, sent);
  return { ok: true };
}

async function sweepAbandonedResumes(supabase: ServiceClient) {
  const cutoff = new Date(Date.now() - ATTEMPT_RETENTION_MS).toISOString();
  const { data, error } = await supabase
    .from("resume_uploads")
    .select("storage_path")
    .is("consumed_at", null)
    .lt("created_at", cutoff)
    .limit(20);

  if (error || !data?.length) {
    if (error) console.warn("Could not list abandoned resumes:", error.message);
    return;
  }

  const paths = data
    .map((row) => row.storage_path)
    .filter((path): path is string => typeof path === "string" && isResumeStoragePath(path));

  if (paths.length === 0) return;

  const { error: removeError } = await supabase.storage.from(RESUME_BUCKET).remove(paths);
  if (removeError) console.warn("Could not remove abandoned resumes:", removeError.message);

  const { error: deleteError } = await supabase.from("resume_uploads").delete().in("storage_path", paths);
  if (deleteError) console.warn("Could not delete abandoned resume tickets:", deleteError.message);
}

export async function createResumeTicket(input: {
  fileName: string;
  fileSize: number;
  honeypot: string;
}): Promise<ResumeTicketResult> {
  if (isHoneypotTripped(input.honeypot)) return { ok: true, skipped: true };

  const kind = resumeKindFromName(input.fileName);
  if (
    !kind ||
    !Number.isFinite(input.fileSize) ||
    input.fileSize <= 0 ||
    input.fileSize > RESUME_MAX_BYTES
  ) {
    return { ok: false, error: RESUME_FILE_ERROR };
  }

  const supabase = serviceClientOrNull();
  if (!supabase) return { ok: false, error: FORM_SAVE_ERROR };

  const ipHash = await requestIpHash();
  await sweepAbandonedResumes(supabase);

  if (ipHash) {
    const since = new Date(Date.now() - HOUR_MS).toISOString();
    const uploads = await countSince(supabase, "resume_uploads", "ip_hash", ipHash, ipHash, since);
    if (uploads !== null && uploads >= JOB_UPLOAD_LIMIT_PER_HOUR) {
      return { ok: false, error: FORM_RATE_LIMIT_ERROR };
    }
  }

  const storagePath = `${randomUUID()}/${safeResumeFileName(input.fileName, kind)}`;
  const { error: ticketError } = await supabase.from("resume_uploads").insert({
    storage_path: storagePath,
    ip_hash: ipHash,
  });

  if (ticketError) {
    console.error("Could not create a resume upload ticket:", ticketError.message);
    return { ok: false, error: FORM_SAVE_ERROR };
  }

  const { data, error } = await supabase.storage.from(RESUME_BUCKET).createSignedUploadUrl(storagePath);
  if (error || !data?.token) {
    console.error("Could not create a resume upload URL:", error?.message ?? "no token");
    await supabase.from("resume_uploads").delete().eq("storage_path", storagePath);
    return { ok: false, error: FORM_SAVE_ERROR };
  }

  return { ok: true, skipped: false, path: storagePath, token: data.token };
}

async function readResume(
  supabase: ServiceClient,
  path: string
): Promise<{ bytes: Uint8Array; kind: ResumeKind } | { error: string }> {
  const { data: ticket, error: ticketError } = await supabase
    .from("resume_uploads")
    .select("id, created_at, consumed_at")
    .eq("storage_path", path)
    .maybeSingle();

  if (ticketError || !ticket || ticket.consumed_at) {
    return { error: "Upload your resume again, then submit the application." };
  }

  const createdAt = new Date(ticket.created_at).getTime();
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > UPLOAD_TICKET_MS) {
    return { error: "That resume upload expired. Choose the file again." };
  }

  const kind = resumeKindFromName(path);
  if (!kind) return { error: RESUME_FILE_ERROR };

  const { data, error } = await supabase.storage.from(RESUME_BUCKET).download(path);
  if (error || !data) {
    console.error("Could not read an uploaded resume:", error?.message ?? "no file");
    return { error: "Upload your resume again, then submit the application." };
  }

  if (data.size <= 0 || data.size > RESUME_MAX_BYTES) {
    await supabase.storage.from(RESUME_BUCKET).remove([path]);
    await supabase.from("resume_uploads").delete().eq("storage_path", path);
    return { error: RESUME_FILE_ERROR };
  }

  const bytes = new Uint8Array(await data.arrayBuffer());
  if (!resumeMatchesMagic(kind, bytes)) {
    await supabase.storage.from(RESUME_BUCKET).remove([path]);
    await supabase.from("resume_uploads").delete().eq("storage_path", path);
    return { error: RESUME_FILE_ERROR };
  }

  return { bytes, kind };
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
    resumePath: fieldValue(formData.get("resumePath")),
  });
  if (!parsed.ok) return parsed;

  if (isHoneypotTripped(formData.get(HONEYPOT_FIELD))) {
    return { ok: true };
  }

  const supabase = serviceClientOrNull();
  if (!supabase) return { ok: false, error: FORM_SAVE_ERROR };

  const ipHash = await requestIpHash();
  if (await overAttemptLimit(supabase, "job", ipHash, JOB_SUBMIT_LIMIT_PER_HOUR)) {
    return { ok: false, error: FORM_RATE_LIMIT_ERROR };
  }

  const { value } = parsed;
  const resume = await readResume(supabase, value.resumePath);
  if ("error" in resume) return { ok: false, error: resume.error };

  const { data: consumed, error: consumeError } = await supabase
    .from("resume_uploads")
    .update({ consumed_at: new Date().toISOString() })
    .eq("storage_path", value.resumePath)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle();

  if (consumeError || !consumed) {
    return { ok: false, error: "Upload your resume again, then submit the application." };
  }

  await recordAttempt(supabase, "job", ipHash);
  const recipientPromise = recipientEmail(JOBS_RECIPIENT_KEY);
  const { data, error } = await supabase
    .from("job_applications")
    .insert({
      full_name: value.fullName,
      email: value.email,
      phone: value.phone,
      city: value.city,
      state: value.state,
      position: value.position,
      website_url: value.website,
      resume_path: value.resumePath,
      cover_letter: value.coverLetter,
      heard_about: value.heardAbout,
      consent: true,
      ip_hash: ipHash,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    console.error("Could not save job application:", error?.message ?? "no id");
    await supabase
      .from("resume_uploads")
      .update({ consumed_at: null })
      .eq("storage_path", value.resumePath);
    return { ok: false, error: FORM_SAVE_ERROR };
  }

  const filename = value.resumePath.split("/").pop() ?? `resume.${resume.kind}`;
  const { data: signed, error: signedError } = await supabase.storage
    .from(RESUME_BUCKET)
    .createSignedUrl(value.resumePath, RESUME_LINK_SECONDS, { download: filename });

  if (signedError || !signed?.signedUrl) {
    console.warn("Could not create a resume download link:", signedError?.message ?? "no url");
  }

  const resumeLines = signed?.signedUrl
    ? [
        "Resume download (this link works for 7 days):",
        signed.signedUrl,
        "",
        `The file is also in the private Supabase Storage bucket "${RESUME_BUCKET}" at:`,
        value.resumePath,
      ]
    : [
        "The resume is attached to this email.",
        `It is also in the private Supabase Storage bucket "${RESUME_BUCKET}" at:`,
        value.resumePath,
      ];

  const to = await recipientPromise;
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
      ...resumeLines,
    ].join("\n"),
    attachments: signed?.signedUrl
      ? undefined
      : [
          {
            filename,
            content: Buffer.from(resume.bytes),
            contentType: RESUME_MIME[resume.kind],
          },
        ],
  });

  await markEmailResult(supabase, "job_applications", data.id, sent);
  return { ok: true };
}
