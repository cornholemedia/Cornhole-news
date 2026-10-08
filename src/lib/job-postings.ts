import "server-only";
import { sendSiteEmail } from "@/lib/email";
import {
  FORM_RATE_LIMIT_ERROR,
  FORM_SAVE_ERROR,
  HONEYPOT_FIELD,
  JOB_POSTING_LIMIT_PER_HOUR,
  emailSubject,
  fieldValue,
  isHoneypotTripped,
  type FormStatus,
} from "@/lib/form-fields";
import {
  endOfMidwestDay,
  isMidwestState,
  midwestStateName,
  parseJobPostingFields,
  paySummary,
  workTypeLabel,
  employmentTypeLabel,
  type EmploymentType,
  type MidwestStateCode,
  type PayPeriod,
  type PublicJobPosting,
  type WorkType,
} from "@/lib/job-board";
import { requestIpHash } from "@/lib/request-ip";
import { JOBS_RECIPIENT_KEY, recipientEmail } from "@/lib/site-settings";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const MIGRATION_HINT =
  "Job postings are not in the database yet. In Supabase, open the SQL editor and run supabase/migrations/20261009_job_postings.sql.";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type JobPostingStatus = "pending" | "approved" | "rejected";

export type AdminJobPosting = PublicJobPosting & {
  posterName: string;
  posterEmail: string;
  status: JobPostingStatus;
  termsAccepted: boolean;
  emailSent: boolean;
  listingFeeCents: number;
  paymentStatus: string;
};

export type AdminJobList = {
  postings: AdminJobPosting[];
  pendingCount: number;
  loadError: string | null;
};

type PublicRow = {
  id: string;
  title: string;
  company_name: string;
  company_website: string | null;
  city: string;
  state: string;
  work_type: string;
  employment_type: string;
  pay_min: number | string | null;
  pay_max: number | string | null;
  pay_period: string | null;
  pay_note: string | null;
  description: string;
  apply_url: string | null;
  apply_email: string | null;
  approved_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

type AdminRow = PublicRow & {
  poster_name: string;
  poster_email: string;
  status: string;
  terms_accepted: boolean;
  email_sent: boolean;
  listing_fee_cents: number | null;
  payment_status: string | null;
};

const PUBLIC_COLUMNS =
  "id, title, company_name, company_website, city, state, work_type, employment_type, pay_min, pay_max, pay_period, pay_note, description, apply_url, apply_email, approved_at, expires_at, created_at, updated_at";

function money(value: number | string | null): number | null {
  if (value === null || value === "") return null;
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function asState(value: string): MidwestStateCode {
  return isMidwestState(value) ? value : "IL";
}

function asWorkType(value: string): WorkType {
  if (value === "on_site" || value === "hybrid" || value === "remote") return value;
  return "on_site";
}

function asEmployment(value: string): EmploymentType {
  if (
    value === "full_time" ||
    value === "part_time" ||
    value === "contract" ||
    value === "temporary" ||
    value === "internship"
  ) {
    return value;
  }
  return "full_time";
}

function asPayPeriod(value: string | null): PayPeriod | null {
  if (
    value === "hour" ||
    value === "day" ||
    value === "week" ||
    value === "month" ||
    value === "year"
  ) {
    return value;
  }
  return null;
}

function asStatus(value: string): JobPostingStatus {
  if (value === "approved" || value === "rejected") return value;
  return "pending";
}

export function isJobId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function toPublicJob(row: PublicRow): PublicJobPosting {
  return {
    id: row.id,
    title: row.title,
    companyName: row.company_name,
    companyWebsite: row.company_website,
    city: row.city,
    state: asState(row.state),
    workType: asWorkType(row.work_type),
    employmentType: asEmployment(row.employment_type),
    payMin: money(row.pay_min),
    payMax: money(row.pay_max),
    payPeriod: asPayPeriod(row.pay_period),
    payNote: row.pay_note ?? "",
    description: row.description,
    applyUrl: row.apply_url,
    applyEmail: row.apply_email,
    approvedAt: row.approved_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toAdminJob(row: AdminRow): AdminJobPosting {
  return {
    ...toPublicJob(row),
    posterName: row.poster_name,
    posterEmail: row.poster_email,
    status: asStatus(row.status),
    termsAccepted: row.terms_accepted,
    emailSent: Boolean(row.email_sent),
    listingFeeCents: row.listing_fee_cents ?? 0,
    paymentStatus: row.payment_status ?? "not_required",
  };
}

function missingTable(message: string): boolean {
  return /job_postings|schema cache|does not exist|admin_job_postings/i.test(message);
}

function emailErrorText(error?: string): string | null {
  if (!error) return null;
  const clean = error.replace(/[\r\n]/g, " ").trim().slice(0, 500);
  return clean || null;
}

export function postingFieldsFromForm(
  formData: FormData,
  options?: { termsAlreadyAccepted?: boolean }
) {
  return parseJobPostingFields({
    title: fieldValue(formData.get("title")),
    companyName: fieldValue(formData.get("companyName")),
    companyWebsite: fieldValue(formData.get("companyWebsite")),
    city: fieldValue(formData.get("city")),
    state: fieldValue(formData.get("state")),
    workType: fieldValue(formData.get("workType")),
    employmentType: fieldValue(formData.get("employmentType")),
    payMin: fieldValue(formData.get("payMin")),
    payMax: fieldValue(formData.get("payMax")),
    payPeriod: fieldValue(formData.get("payPeriod")),
    payNote: fieldValue(formData.get("payNote")),
    description: fieldValue(formData.get("description")),
    applyUrl: fieldValue(formData.get("applyUrl")),
    applyEmail: fieldValue(formData.get("applyEmail")),
    posterName: fieldValue(formData.get("posterName")),
    posterEmail: fieldValue(formData.get("posterEmail")),
    termsAccepted: options?.termsAlreadyAccepted === true || formData.get("terms") === "on",
  });
}

export async function getPublicJobPostings(state?: MidwestStateCode | null): Promise<{
  jobs: PublicJobPosting[];
  loadError: string | null;
}> {
  if (!isSupabaseConfigured()) return { jobs: [], loadError: null };

  try {
    const supabase = await createClient();
    let query = supabase
      .from("job_postings_public")
      .select(PUBLIC_COLUMNS)
      .order("approved_at", { ascending: false });

    if (state) query = query.eq("state", state);

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching job postings:", error.message);
      return {
        jobs: [],
        loadError: missingTable(error.message) ? null : error.message,
      };
    }

    return { jobs: ((data ?? []) as PublicRow[]).map(toPublicJob), loadError: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load jobs.";
    console.error("Error fetching job postings:", message);
    return { jobs: [], loadError: missingTable(message) ? null : message };
  }
}

export async function getPublicJobPosting(id: string): Promise<{
  job: PublicJobPosting | null;
  loadError: string | null;
}> {
  if (!isJobId(id) || !isSupabaseConfigured()) return { job: null, loadError: null };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("job_postings_public")
      .select(PUBLIC_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching a job posting:", error.message);
      return { job: null, loadError: error.message };
    }

    return { job: data ? toPublicJob(data as PublicRow) : null, loadError: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load that job.";
    console.error("Error fetching a job posting:", message);
    return { job: null, loadError: message };
  }
}

export async function getSitemapJobPostings(): Promise<
  Pick<PublicJobPosting, "id" | "approvedAt" | "updatedAt">[]
> {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("job_postings_public")
      .select("id, approved_at, updated_at")
      .order("approved_at", { ascending: false })
      .limit(1000);

    if (error) {
      console.error("Error fetching sitemap jobs:", error.message);
      return [];
    }

    return ((data ?? []) as Pick<PublicRow, "id" | "approved_at" | "updated_at">[]).map((row) => ({
      id: row.id,
      approvedAt: row.approved_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    console.error(
      "Error fetching sitemap jobs:",
      error instanceof Error ? error.message : "unknown error"
    );
    return [];
  }
}

export async function getJobPostingsForAdmin(): Promise<AdminJobList> {
  const empty: AdminJobList = { postings: [], pendingCount: 0, loadError: null };
  if (!isSupabaseConfigured()) {
    return { ...empty, loadError: "Supabase is not configured, so job postings cannot be loaded." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_job_postings");
    if (error) {
      console.error("Error fetching admin job postings:", error.message);
      return {
        ...empty,
        loadError: missingTable(error.message) ? MIGRATION_HINT : error.message,
      };
    }

    const postings = ((data ?? []) as AdminRow[]).map(toAdminJob);
    return {
      postings,
      pendingCount: postings.filter((posting) => posting.status === "pending").length,
      loadError: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load job postings.";
    console.error("Error fetching admin job postings:", message);
    return {
      ...empty,
      loadError: missingTable(message) ? MIGRATION_HINT : message,
    };
  }
}

export async function getJobPostingForAdmin(id: string): Promise<{
  posting: AdminJobPosting | null;
  loadError: string | null;
}> {
  if (!isJobId(id)) return { posting: null, loadError: null };
  const list = await getJobPostingsForAdmin();
  if (list.loadError) return { posting: null, loadError: list.loadError };
  return {
    posting: list.postings.find((posting) => posting.id === id) ?? null,
    loadError: null,
  };
}

export async function submitJobPostingForm(formData: FormData): Promise<FormStatus> {
  const parsed = postingFieldsFromForm(formData);
  if (!parsed.ok) return parsed;

  if (isHoneypotTripped(formData.get(HONEYPOT_FIELD))) {
    return { ok: true };
  }

  if (!isSupabaseConfigured()) return { ok: false, error: FORM_SAVE_ERROR };

  const supabase = await createClient();
  const ipHash = await requestIpHash();
  if (ipHash) {
    const { data, error } = await supabase.rpc("record_form_attempt", {
      p_form: "job_posting",
      p_ip_hash: ipHash,
    });
    if (error) {
      console.warn("Could not record a job posting attempt:", error.message);
      return { ok: false, error: FORM_SAVE_ERROR };
    }
    if (data !== true) return { ok: false, error: FORM_RATE_LIMIT_ERROR };
  }

  const { value } = parsed;
  const to = await recipientEmail(JOBS_RECIPIENT_KEY);
  const location = `${value.city}, ${midwestStateName(value.state)}`;
  const sent = await sendSiteEmail({
    to,
    replyTo: value.posterEmail,
    subject: emailSubject("New Midwest job posting: ", `${value.title} at ${value.companyName}`),
    text: [
      "A new job is waiting for review on Cornhole News.",
      "It is not public until you approve it.",
      "",
      `Title: ${value.title}`,
      `Company: ${value.companyName}`,
      `Company website: ${value.companyWebsite ?? "(not provided)"}`,
      `Location: ${location}`,
      `Work type: ${workTypeLabel(value.workType)}`,
      `Employment type: ${employmentTypeLabel(value.employmentType)}`,
      `Pay: ${paySummary(value)}`,
      `Apply link: ${value.applyUrl ?? "(not provided)"}`,
      `Apply email: ${value.applyEmail ?? "(not provided)"}`,
      `Poster: ${value.posterName} <${value.posterEmail}>`,
      "",
      "Description:",
      value.description,
      "",
      "Review it at https://cornholenews.news/admin",
    ].join("\n"),
  });

  const { error } = await supabase.from("job_postings").insert({
    title: value.title,
    company_name: value.companyName,
    company_website: value.companyWebsite,
    city: value.city,
    state: value.state,
    work_type: value.workType,
    employment_type: value.employmentType,
    pay_min: value.payMin,
    pay_max: value.payMax,
    pay_period: value.payPeriod,
    pay_note: value.payNote,
    description: value.description,
    apply_url: value.applyUrl,
    apply_email: value.applyEmail,
    poster_name: value.posterName,
    poster_email: value.posterEmail,
    terms_accepted: true,
    email_sent: sent.sent,
    email_error: sent.sent ? null : emailErrorText(sent.error),
    ip_hash: ipHash,
  });

  if (error) {
    console.error("Could not save job posting:", error.message);
    return { ok: false, error: FORM_SAVE_ERROR };
  }

  return { ok: true };
}

export function expiresFromAdminDate(value: string, current: string | null): string | null | "invalid" {
  const text = value.trim();
  if (!text) return current;
  const next = endOfMidwestDay(text);
  return next ?? "invalid";
}

export const JOB_POSTING_HOURLY_LIMIT = JOB_POSTING_LIMIT_PER_HOUR;
