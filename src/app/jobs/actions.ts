"use server";

import { FORM_SAVE_ERROR, type FormStatus } from "@/lib/form-fields";
import { submitJobPostingForm } from "@/lib/job-postings";

export async function submitJobPosting(
  _prev: FormStatus,
  formData: FormData
): Promise<FormStatus> {
  try {
    return await submitJobPostingForm(formData);
  } catch (error) {
    console.error(
      "Job posting failed:",
      error instanceof Error ? error.message : "unknown error"
    );
    return { ok: false, error: FORM_SAVE_ERROR };
  }
}
