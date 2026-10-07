"use server";

import { FORM_SAVE_ERROR, type FormStatus } from "@/lib/form-fields";
import { createResumeTicket, submitJobForm, type ResumeTicketResult } from "@/lib/submissions";

export async function prepareResumeUpload(input: {
  fileName: string;
  fileSize: number;
  honeypot: string;
}): Promise<ResumeTicketResult> {
  try {
    return await createResumeTicket(input);
  } catch (error) {
    console.error("Resume upload failed:", error instanceof Error ? error.message : "unknown error");
    return { ok: false, error: FORM_SAVE_ERROR };
  }
}

export async function submitJobApplication(formData: FormData): Promise<FormStatus> {
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
