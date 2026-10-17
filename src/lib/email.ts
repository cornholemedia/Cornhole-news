import "server-only";
import type { Attachment } from "resend";

let loggedMissingFrom = false;

export function contactFromAddress(): string | null {
  const configured = process.env.CONTACT_FROM_EMAIL?.trim();
  if (configured) return configured;

  if (!loggedMissingFrom) {
    loggedMissingFrom = true;
    console.error(
      "CONTACT_FROM_EMAIL is not set. No email was sent. Set it to a verified sender such as Cornhole News <noreply@cornholenews.news> and redeploy."
    );
  }
  return null;
}

export async function sendSiteEmail(input: {
  to: string;
  replyTo: string;
  subject: string;
  text: string;
  attachments?: Attachment[];
}): Promise<{ sent: boolean; error?: string }> {
  const from = contactFromAddress();
  if (!from) return { sent: false, error: "missing_from_address" };

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
      from,
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
