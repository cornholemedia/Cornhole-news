"use server";

import { submitContactForm } from "@/lib/submissions";
import { FORM_SAVE_ERROR, type FormStatus } from "@/lib/form-fields";

export async function submitContact(_prev: FormStatus, formData: FormData): Promise<FormStatus> {
  try {
    return await submitContactForm(formData);
  } catch (error) {
    console.error("Contact form failed:", error instanceof Error ? error.message : "unknown error");
    return { ok: false, error: FORM_SAVE_ERROR };
  }
}
