"use server";

import { FORM_SAVE_ERROR, type FormStatus } from "@/lib/form-fields";
import { submitJobForm } from "@/lib/submissions";

export async function submitJobApplication(
  _prev: FormStatus,
  formData: FormData
): Promise<FormStatus> {
  try {
    return await submitJobForm(formData);
  } catch (error) {
    console.error(
      "Job application failed:",
      error instanceof Error ? error.message : "unknown error"
    );
    return { ok: false, error: FORM_SAVE_ERROR };
  }
}
