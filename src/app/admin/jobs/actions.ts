"use server";

import { revalidatePath } from "next/cache";
import { FORM_SAVE_ERROR, fieldValue, type FormStatus } from "@/lib/form-fields";
import { expiresFromAdminDate, isJobId, postingFieldsFromForm } from "@/lib/job-postings";
import { createClient } from "@/lib/supabase/server";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

async function adminClient(): Promise<
  | { supabase: Awaited<ReturnType<typeof createClient>>; error: null }
  | { supabase: null; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase: null, error: "Sign in as an admin to do that." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    return { supabase: null, error: "You need an admin account to do that." };
  }

  return { supabase, error: null };
}

function revalidateJob(id?: string) {
  revalidatePath("/jobs");
  revalidatePath("/admin");
  revalidatePath("/sitemap.xml");
  if (id) {
    revalidatePath(`/jobs/${id}`);
    revalidatePath(`/admin/jobs/${id}`);
  }
}

async function updateJob(
  id: string,
  values: Record<string, unknown>,
  missing: string
): Promise<AdminActionResult> {
  if (!isJobId(id)) return { ok: false, error: "That job could not be found." };
  const { supabase, error } = await adminClient();
  if (error || !supabase) return { ok: false, error: error ?? "You need an admin account to do that." };

  const { data, error: updateError } = await supabase
    .from("job_postings")
    .update(values)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (updateError) {
    console.error("Could not update a job posting:", updateError.message);
    return { ok: false, error: "That job could not be updated." };
  }
  if (!data) return { ok: false, error: missing };

  revalidateJob(id);
  return { ok: true };
}

export async function approveJobPosting(id: string): Promise<AdminActionResult> {
  return updateJob(id, { status: "approved" }, "That job could not be approved.");
}

export async function rejectJobPosting(id: string): Promise<AdminActionResult> {
  return updateJob(id, { status: "rejected" }, "That job could not be rejected.");
}

export async function deleteJobPosting(id: string): Promise<AdminActionResult> {
  if (!isJobId(id)) return { ok: false, error: "That job could not be found." };
  const { supabase, error } = await adminClient();
  if (error || !supabase) return { ok: false, error: error ?? "You need an admin account to do that." };

  const { data, error: deleteError } = await supabase
    .from("job_postings")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (deleteError) {
    console.error("Could not delete a job posting:", deleteError.message);
    return { ok: false, error: "That job could not be deleted." };
  }
  if (!data) return { ok: false, error: "That job could not be deleted." };

  revalidateJob(id);
  return { ok: true };
}

export async function extendJobPosting(id: string): Promise<AdminActionResult> {
  if (!isJobId(id)) return { ok: false, error: "That job could not be found." };
  const { supabase, error } = await adminClient();
  if (error || !supabase) return { ok: false, error: error ?? "You need an admin account to do that." };

  const { data: current, error: readError } = await supabase
    .from("job_postings")
    .select("expires_at, status")
    .eq("id", id)
    .maybeSingle();

  if (readError || !current) return { ok: false, error: "That job could not be found." };
  if (current.status !== "approved") {
    return { ok: false, error: "Approve the job before extending it." };
  }

  const currentTime = current.expires_at ? new Date(current.expires_at).getTime() : 0;
  const base = Math.max(Date.now(), Number.isFinite(currentTime) ? currentTime : 0);
  const expiresAt = new Date(base + 30 * 24 * 60 * 60 * 1000).toISOString();
  return updateJob(id, { expires_at: expiresAt }, "That job could not be extended.");
}

export async function saveJobPosting(_prev: FormStatus, formData: FormData): Promise<FormStatus> {
  try {
    const id = fieldValue(formData.get("id"));
    if (!isJobId(id)) return { ok: false, error: "That job could not be found." };

    const parsed = postingFieldsFromForm(formData, { termsAlreadyAccepted: true });
    if (!parsed.ok) return parsed;

    const { supabase, error } = await adminClient();
    if (error || !supabase) return { ok: false, error: error ?? FORM_SAVE_ERROR };

    const { data: current, error: readError } = await supabase
      .from("job_postings")
      .select("expires_at, status")
      .eq("id", id)
      .maybeSingle();

    if (readError || !current) return { ok: false, error: "That job could not be found." };

    const expires = expiresFromAdminDate(fieldValue(formData.get("expiresOn")), current.expires_at);
    if (expires === "invalid") return { ok: false, error: "Enter a valid expiry date." };

    let expiresAt = expires;
    if (!expiresAt && current.status === "approved") {
      expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    const { value } = parsed;
    const { data, error: updateError } = await supabase
      .from("job_postings")
      .update({
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
        expires_at: expiresAt,
      })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (updateError) {
      console.error("Could not save a job posting:", updateError.message);
      return { ok: false, error: FORM_SAVE_ERROR };
    }
    if (!data) return { ok: false, error: "That job could not be saved." };

    revalidateJob(id);
    return { ok: true, message: "Saved." };
  } catch (error) {
    console.error(
      "Saving a job posting failed:",
      error instanceof Error ? error.message : "unknown error"
    );
    return { ok: false, error: FORM_SAVE_ERROR };
  }
}
