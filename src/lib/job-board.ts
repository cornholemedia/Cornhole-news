import { cleanEmail, cleanLine, cleanOptionalLine, cleanUrl } from "@/lib/form-fields";

export const JOB_DESCRIPTION_MIN = 40;
export const JOB_DESCRIPTION_MAX = 8000;

export const MIDWEST_STATES = [
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MO", name: "Missouri" },
  { code: "NE", name: "Nebraska" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "SD", name: "South Dakota" },
  { code: "WI", name: "Wisconsin" },
] as const;

export const WORK_TYPES = [
  { value: "on_site", label: "On-site" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
] as const;

export const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "temporary", label: "Temporary" },
  { value: "internship", label: "Internship" },
] as const;

export const PAY_PERIODS = [
  { value: "hour", label: "Hourly", unitText: "HOUR" },
  { value: "day", label: "Daily", unitText: "DAY" },
  { value: "week", label: "Weekly", unitText: "WEEK" },
  { value: "month", label: "Monthly", unitText: "MONTH" },
  { value: "year", label: "Yearly", unitText: "YEAR" },
] as const;

const EMPLOYMENT_SCHEMA: Record<EmploymentType, string> = {
  full_time: "FULL_TIME",
  part_time: "PART_TIME",
  contract: "CONTRACTOR",
  temporary: "TEMPORARY",
  internship: "INTERN",
};

export type MidwestStateCode = (typeof MIDWEST_STATES)[number]["code"];
export type WorkType = (typeof WORK_TYPES)[number]["value"];
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]["value"];
export type PayPeriod = (typeof PAY_PERIODS)[number]["value"];

export type JobPostingInput = {
  title: string;
  companyName: string;
  companyWebsite: string | null;
  city: string;
  state: MidwestStateCode;
  workType: WorkType;
  employmentType: EmploymentType;
  payMin: number | null;
  payMax: number | null;
  payPeriod: PayPeriod | null;
  payNote: string;
  description: string;
  applyUrl: string | null;
  applyEmail: string | null;
  posterName: string;
  posterEmail: string;
  termsAccepted: true;
};

export type PublicJobPosting = {
  id: string;
  title: string;
  companyName: string;
  companyWebsite: string | null;
  city: string;
  state: MidwestStateCode;
  workType: WorkType;
  employmentType: EmploymentType;
  payMin: number | null;
  payMax: number | null;
  payPeriod: PayPeriod | null;
  payNote: string;
  description: string;
  applyUrl: string | null;
  applyEmail: string | null;
  approvedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const MONEY_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;

export function isMidwestState(value: string): value is MidwestStateCode {
  return MIDWEST_STATES.some((state) => state.code === value);
}

export function midwestStateName(code: string): string {
  return MIDWEST_STATES.find((state) => state.code === code)?.name ?? code;
}

export function workTypeLabel(value: string): string {
  return WORK_TYPES.find((item) => item.value === value)?.label ?? value;
}

export function employmentTypeLabel(value: string): string {
  return EMPLOYMENT_TYPES.find((item) => item.value === value)?.label ?? value;
}

export function payPeriodLabel(value: string | null): string {
  if (!value) return "";
  const period = PAY_PERIODS.find((item) => item.value === value);
  return period ? period.label.toLowerCase() : value;
}

function optionValue<T extends string>(
  value: string,
  options: readonly { value: T }[]
): T | null {
  const match = options.find((item) => item.value === value.trim());
  return match ? match.value : null;
}

function optionalUrl(value: string): string | null | "invalid" {
  const cleaned = cleanUrl(value);
  if (cleaned === null) return "invalid";
  return cleaned || null;
}

function optionalMoney(value: string): number | null | "invalid" {
  const text = value.trim().replace(/[$,]/g, "");
  if (!text) return null;
  if (!MONEY_PATTERN.test(text)) return "invalid";
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0 || amount > 99999999.99) return "invalid";
  return amount;
}

function cleanDescription(value: string): string | null {
  const text = value.replace(/\r\n/g, "\n").trim();
  if (text.length < JOB_DESCRIPTION_MIN || text.length > JOB_DESCRIPTION_MAX) return null;
  if (CONTROL_CHARS.test(text)) return null;
  return text;
}

export function parseJobPostingFields(input: {
  title: string;
  companyName: string;
  companyWebsite: string;
  city: string;
  state: string;
  workType: string;
  employmentType: string;
  payMin: string;
  payMax: string;
  payPeriod: string;
  payNote: string;
  description: string;
  applyUrl: string;
  applyEmail: string;
  posterName: string;
  posterEmail: string;
  termsAccepted: boolean;
}): { ok: true; value: JobPostingInput } | { ok: false; error: string } {
  const title = cleanLine(input.title, 200);
  if (!title) return { ok: false, error: "Enter a job title." };

  const companyName = cleanLine(input.companyName, 200);
  if (!companyName) return { ok: false, error: "Enter the company name." };

  const companyWebsite = optionalUrl(input.companyWebsite);
  if (companyWebsite === "invalid") {
    return { ok: false, error: "Company website must be an http or https link." };
  }

  const city = cleanLine(input.city, 80);
  if (!city) return { ok: false, error: "Enter the city." };

  const state = input.state.trim().toUpperCase();
  if (!isMidwestState(state)) return { ok: false, error: "Choose a Midwest state." };

  const workType = optionValue(input.workType, WORK_TYPES);
  if (!workType) return { ok: false, error: "Choose on-site, hybrid, or remote." };

  const employmentType = optionValue(input.employmentType, EMPLOYMENT_TYPES);
  if (!employmentType) return { ok: false, error: "Choose an employment type." };

  const payMin = optionalMoney(input.payMin);
  if (payMin === "invalid") {
    return { ok: false, error: "Pay minimum must be a dollar amount, such as 18 or 18.50." };
  }

  const payMax = optionalMoney(input.payMax);
  if (payMax === "invalid") {
    return { ok: false, error: "Pay maximum must be a dollar amount, such as 24 or 24.00." };
  }

  if (payMin !== null && payMax !== null && payMax < payMin) {
    return { ok: false, error: "Pay maximum must be at least the minimum." };
  }

  const payPeriodRaw = input.payPeriod.trim();
  const payPeriod = payPeriodRaw ? optionValue(payPeriodRaw, PAY_PERIODS) : null;
  if (payPeriodRaw && !payPeriod) return { ok: false, error: "Choose how often that pay is." };

  if ((payMin !== null || payMax !== null) && !payPeriod) {
    return { ok: false, error: "Choose whether the pay is hourly, yearly, or another period." };
  }

  if (payPeriod && payMin === null && payMax === null) {
    return { ok: false, error: "Enter a minimum or maximum pay, or clear the pay period." };
  }

  const payNote = cleanOptionalLine(input.payNote, 300);
  if (payNote === null) return { ok: false, error: "Pay note must be 300 characters or fewer." };

  const description = cleanDescription(input.description);
  if (!description) {
    return {
      ok: false,
      error: `Describe the job in ${JOB_DESCRIPTION_MIN.toLocaleString("en-US")} to ${JOB_DESCRIPTION_MAX.toLocaleString("en-US")} characters.`,
    };
  }

  const applyUrl = optionalUrl(input.applyUrl);
  if (applyUrl === "invalid") {
    return { ok: false, error: "Apply link must be an http or https link." };
  }

  const applyEmailRaw = input.applyEmail.trim();
  const applyEmail = applyEmailRaw ? cleanEmail(applyEmailRaw) : null;
  if (applyEmailRaw && !applyEmail) {
    return { ok: false, error: "Apply email must be a valid email address." };
  }

  if (!applyUrl && !applyEmail) {
    return { ok: false, error: "Enter an apply link, an apply email, or both." };
  }

  const posterName = cleanLine(input.posterName, 200);
  if (!posterName) return { ok: false, error: "Enter your name so we can review the posting." };

  const posterEmail = cleanEmail(input.posterEmail);
  if (!posterEmail) return { ok: false, error: "Enter your email so we can review the posting." };

  if (!input.termsAccepted) {
    return {
      ok: false,
      error: "Agree to the Terms and confirm the job is real and located in the Midwest.",
    };
  }

  return {
    ok: true,
    value: {
      title,
      companyName,
      companyWebsite,
      city,
      state,
      workType,
      employmentType,
      payMin,
      payMax,
      payPeriod,
      payNote,
      description,
      applyUrl,
      applyEmail,
      posterName,
      posterEmail,
      termsAccepted: true,
    },
  };
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function paySummary(input: {
  payMin: number | null;
  payMax: number | null;
  payPeriod: string | null;
  payNote: string;
}): string {
  const period = payPeriodLabel(input.payPeriod);
  let amount = "";
  if (input.payMin !== null && input.payMax !== null && input.payMin !== input.payMax) {
    amount = `${formatUsd(input.payMin)}–${formatUsd(input.payMax)}`;
  } else if (input.payMin !== null && input.payMax !== null) {
    amount = formatUsd(input.payMin);
  } else if (input.payMin !== null) {
    amount = `From ${formatUsd(input.payMin)}`;
  } else if (input.payMax !== null) {
    amount = `Up to ${formatUsd(input.payMax)}`;
  }

  const pay = amount && period ? `${amount} ${period}` : amount;
  if (pay && input.payNote) return `${pay}. ${input.payNote}`;
  if (pay) return pay;
  if (input.payNote) return input.payNote;
  return "Pay not listed";
}

export function formatMidwestDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
  }).format(date);
}

export function formatMidwestWhen(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function midwestDateInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function timeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    pick("year"),
    pick("month") - 1,
    pick("day"),
    pick("hour"),
    pick("minute"),
    pick("second")
  );
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** End of the given calendar day in America/Chicago, as an ISO timestamp. */
export function endOfMidwestDay(isoDate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));
  const offset = timeZoneOffsetMinutes(utc, "America/Chicago");
  const zoned = new Date(utc.getTime() - offset * 60_000);
  if (Number.isNaN(zoned.getTime())) return null;
  return zoned.toISOString();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function jobDescriptionHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function jobPostingJsonLd(job: PublicJobPosting, pageUrl: string): Record<string, unknown> {
  const organization: Record<string, unknown> = {
    "@type": "Organization",
    name: job.companyName,
  };
  if (job.companyWebsite) organization.sameAs = job.companyWebsite;

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: jobDescriptionHtml(job.description),
    datePosted: (job.approvedAt ?? job.createdAt).slice(0, 10),
    validThrough: job.expiresAt,
    employmentType: EMPLOYMENT_SCHEMA[job.employmentType],
    hiringOrganization: organization,
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.city,
        addressRegion: job.state,
        addressCountry: "US",
      },
    },
    identifier: {
      "@type": "PropertyValue",
      name: "Cornhole News",
      value: job.id,
    },
    url: pageUrl,
  };

  if (job.workType === "remote") {
    data.jobLocationType = "TELECOMMUTE";
    data.applicantLocationRequirements = {
      "@type": "State",
      name: midwestStateName(job.state),
    };
  }

  if (job.applyEmail) {
    data.applicationContact = {
      "@type": "ContactPoint",
      email: job.applyEmail,
    };
  }

  const period = PAY_PERIODS.find((item) => item.value === job.payPeriod);
  if (period && (job.payMin !== null || job.payMax !== null)) {
    const value: Record<string, unknown> = {
      "@type": "QuantitativeValue",
      unitText: period.unitText,
    };
    if (job.payMin !== null && job.payMax !== null) {
      value.minValue = job.payMin;
      value.maxValue = job.payMax;
    } else {
      value.value = job.payMin ?? job.payMax;
    }
    data.baseSalary = {
      "@type": "MonetaryAmount",
      currency: "USD",
      value,
    };
  }

  return data;
}

export function jsonLdScript(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
