import "server-only";
import type { Attachment } from "resend";

export const DEFAULT_FROM_EMAIL = "Cornhole News <onboarding@resend.dev>";

export function contactFromAddress(): string {
  const configured = process.env.CONTACT_FROM_EMAIL?.trim();
  return configured || DEFAULT_FROM_EMAIL;
}

export async function sendSiteEmail(input: {
  to: string;
  replyTo: string;
  subject: string;
  text: string;
  attachments?: Attachment[];
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn(
      "RESEND_API_KEY is not set. The form submission was saved, but no email was sent."
    );
    return { sent: false, error: "missing_api_key" };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: contactFromAddress(),
      to: input.to,
      replyTo: input.replyTo,
      subject: input.subject,
      text: input.text,
      attachments: input.attachments,
    });

    if (error) {
      console.warn("Resend rejected a form email:", error.message);
      return { sent: false, error: error.message };
    }

    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email send failed";
    console.warn("Form email failed:", message);
    return { sent: false, error: message };
  }
}
