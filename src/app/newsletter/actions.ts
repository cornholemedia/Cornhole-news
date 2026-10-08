"use server";

import { submitNewsletterForm } from "@/lib/submissions";
import { FORM_SAVE_ERROR, type FormStatus } from "@/lib/form-fields";

export async function subscribeToNewsletter(
  _prev: FormStatus,
  formData: FormData
): Promise<FormStatus> {
  try {
    return await submitNewsletterForm(formData);
  } catch (error) {
    console.error(
      "Newsletter signup failed:",
      error instanceof Error ? error.message : "unknown error"
    );
    return { ok: false, error: FORM_SAVE_ERROR };
  }
}
