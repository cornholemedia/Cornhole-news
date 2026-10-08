export const RESUME_BUCKET = "resumes";
// The private bucket allows 5 MB. The form stops at 4 MB so the same bytes
// can be attached to the email. Vercel rejects function bodies over 4.5 MB.
export const RESUME_BUCKET_MAX_BYTES = 5 * 1024 * 1024;
export const RESUME_MAX_BYTES = 4 * 1024 * 1024;
export const HONEYPOT_FIELD = "hp_confirm";

// Hourly caps enforced inside public.record_form_attempt. Keep the numbers in sync.
export const CONTACT_LIMIT_PER_HOUR = 5;
export const JOB_SUBMIT_LIMIT_PER_HOUR = 3;
export const NEWSLETTER_LIMIT_PER_HOUR = 5;

export const FORM_SAVE_ERROR =
  "We could not save that right now. Please try again in a few minutes, or email cornholemedia@gmail.com.";

export const FORM_RATE_LIMIT_ERROR =
  "You have sent several of these recently. Please wait about an hour and try again.";

export const RESUME_FILE_ERROR = "Upload a PDF, DOC, or DOCX file that is 4 MB or smaller.";

export type FormStatus = {
  ok: boolean;
  error?: string;
  message?: string;
};

export const US_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "District of Columbia",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
] as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export type ResumeKind = "pdf" | "doc" | "docx";

export const RESUME_MIME: Record<ResumeKind, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export type ContactInput = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

export type JobInput = {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  position: string;
  website: string;
  coverLetter: string;
  heardAbout: string;
  consent: boolean;
};

export function fieldValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

export function isHoneypotTripped(value: FormDataEntryValue | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function cleanEmail(value: string): string | null {
  const email = value.trim();
  if (email.length < 3 || email.length > 320) return null;
  if (/[\r\n]/.test(email)) return null;
  if (!EMAIL_PATTERN.test(email)) return null;
  return email;
}

export function cleanNewsletterEmail(value: string): string | null {
  const email = cleanEmail(value);
  return email ? email.toLowerCase() : null;
}

export function cleanSourcePath(value: string): string {
  const text = value.trim();
  if (!text.startsWith("/") || text.startsWith("//") || text.includes("\\") || text.includes("..")) {
    return "";
  }
  if (text.length > 200 || CONTROL_CHARS.test(text) || /[\r\n]/.test(text)) return "";
  return text;
}

function cleanBounded(value: string, max: number, min: number): string | null {
  const text = value.replace(/\r\n/g, "\n").trim();
  if (text.length < min || text.length > max) return null;
  if (CONTROL_CHARS.test(text)) return null;
  return text;
}

export function cleanLine(value: string, max: number, min = 1): string | null {
  const text = cleanBounded(value, max, min);
  if (!text || /[\r\n]/.test(text)) return null;
  return text;
}

export function cleanOptionalLine(value: string, max: number): string | null {
  if (!value.trim()) return "";
  return cleanLine(value, max, 1);
}

export function cleanMessage(value: string, max: number): string | null {
  return cleanBounded(value, max, 1);
}

export function cleanPhone(value: string): string | null {
  const phone = value.trim();
  if (phone.length < 7 || phone.length > 30) return null;
  if (!/^[0-9+().\-\s]+$/.test(phone)) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return phone;
}

export function cleanUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw) return "";
  if (raw.length > 500 || /[\r\n]/.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isUsState(value: string): boolean {
  return (US_STATES as readonly string[]).includes(value);
}

export function parseContactFields(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): { ok: true; value: ContactInput } | { ok: false; error: string } {
  const name = cleanLine(input.name, 200);
  if (!name) return { ok: false, error: "Enter your name." };

  const email = cleanEmail(input.email);
  if (!email) return { ok: false, error: "Enter a valid email address." };

  const subject = cleanOptionalLine(input.subject, 200);
  if (subject === null) {
    return { ok: false, error: "Subject must be 200 characters or fewer." };
  }

  const message = cleanMessage(input.message, 5000);
  if (!message) {
    return { ok: false, error: "Enter a message, up to 5,000 characters." };
  }

  return { ok: true, value: { name, email, subject, message } };
}

export function parseNewsletterFields(input: {
  email: string;
  source: string;
}): { ok: true; value: { email: string; source: string } } | { ok: false; error: string } {
  const email = cleanNewsletterEmail(input.email);
  if (!email) return { ok: false, error: "Enter a valid email address." };

  return { ok: true, value: { email, source: cleanSourcePath(input.source) } };
}

export function parseJobFields(input: {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  position: string;
  website: string;
  coverLetter: string;
  heardAbout: string;
  consent: boolean;
}): { ok: true; value: JobInput } | { ok: false; error: string } {
  const fullName = cleanLine(input.fullName, 200);
  if (!fullName) return { ok: false, error: "Enter your full name." };

  const email = cleanEmail(input.email);
  if (!email) return { ok: false, error: "Enter a valid email address." };

  const phone = cleanPhone(input.phone);
  if (!phone) return { ok: false, error: "Enter a phone number." };

  const city = cleanLine(input.city, 80);
  if (!city) return { ok: false, error: "Enter your city." };

  const state = input.state.trim();
  if (!isUsState(state)) return { ok: false, error: "Choose a state." };

  const position = cleanLine(input.position, 200);
  if (!position) return { ok: false, error: "Enter the position you are applying for." };

  const website = cleanUrl(input.website);
  if (website === null) {
    return { ok: false, error: "Website must be an http or https link." };
  }

  const coverLetter = cleanMessage(input.coverLetter, 5000);
  if (!coverLetter) {
    return { ok: false, error: "Enter a cover letter or message, up to 5,000 characters." };
  }

  const heardAbout = cleanOptionalLine(input.heardAbout, 200);
  if (heardAbout === null) {
    return { ok: false, error: "How you heard about us must be 200 characters or fewer." };
  }

  if (!input.consent) {
    return {
      ok: false,
      error: "Confirm that we may use your application, including your resume, as described.",
    };
  }

  return {
    ok: true,
    value: {
      fullName,
      email,
      phone,
      city,
      state,
      position,
      website,
      coverLetter,
      heardAbout,
      consent: true,
    },
  };
}

export function resumeKindFromName(fileName: string): ResumeKind | null {
  const base = fileName.replace(/\\/g, "/").split("/").pop() ?? "";
  const lower = base.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".doc")) return "doc";
  return null;
}

export function safeResumeFileName(fileName: string, kind: ResumeKind): string {
  const base = fileName.replace(/\\/g, "/").split("/").pop() ?? "resume";
  const stripped = base.replace(/\.[^.]+$/, "");
  const cleaned = stripped
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
  const name = (cleaned || "resume").slice(0, 80);
  return `${name}.${kind}`;
}

export function isResumeStoragePath(path: string): boolean {
  if (path.includes("..") || path.includes("\\") || path.includes("//")) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9][A-Za-z0-9._-]{0,89}$/.test(
    path
  );
}

export function resumeMatchesMagic(kind: ResumeKind, bytes: Uint8Array): boolean {
  if (kind === "pdf") {
    const limit = Math.min(bytes.length, 1024);
    for (let index = 0; index <= limit - 4; index += 1) {
      if (
        bytes[index] === 0x25 &&
        bytes[index + 1] === 0x50 &&
        bytes[index + 2] === 0x44 &&
        bytes[index + 3] === 0x46
      ) {
        return true;
      }
    }
    return false;
  }

  if (kind === "docx") {
    return (
      bytes.length >= 4 &&
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      bytes[2] === 0x03 &&
      bytes[3] === 0x04
    );
  }

  return (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 &&
    bytes[5] === 0xb1 &&
    bytes[6] === 0x1a &&
    bytes[7] === 0xe1
  );
}

export function emailSubject(prefix: string, detail: string): string {
  const clean = detail.replace(/[\r\n]+/g, " ").trim();
  const combined = `${prefix}${clean}`.trim();
  if (combined.length <= 180) return combined;
  return `${combined.slice(0, 177).trimEnd()}...`;
}
