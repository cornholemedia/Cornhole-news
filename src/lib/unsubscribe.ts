import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getSiteUrl } from "@/lib/site";

const MIN_SECRET_LENGTH = 16;

let loggedMissingSecret = false;

function unsubscribeSecret(): string | null {
  const dedicated = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET?.trim() ?? "";
  if (dedicated.length >= MIN_SECRET_LENGTH) return dedicated;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (serviceKey.length >= MIN_SECRET_LENGTH) return serviceKey;

  if (!loggedMissingSecret) {
    loggedMissingSecret = true;
    console.error(
      "Newsletter unsubscribe links were not signed. Set NEWSLETTER_UNSUBSCRIBE_SECRET to a random string of at least 16 characters, or set SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return null;
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signNewsletterUnsubscribe(email: string): string | null {
  const secret = unsubscribeSecret();
  if (!secret) return null;
  const payload = Buffer.from(email.trim().toLowerCase(), "utf8").toString("base64url");
  return `${payload}.${signPayload(payload, secret)}`;
}

export function newsletterUnsubscribeUrl(email: string): string | null {
  const token = signNewsletterUnsubscribe(email);
  if (!token) return null;
  return `${getSiteUrl()}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function readNewsletterUnsubscribeToken(token: string): string | null {
  const secret = unsubscribeSecret();
  if (!secret) return null;

  const trimmed = token.trim();
  const splitAt = trimmed.lastIndexOf(".");
  if (splitAt <= 0) return null;

  const payload = trimmed.slice(0, splitAt);
  const signature = trimmed.slice(splitAt + 1);
  const expected = signPayload(payload, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  try {
    const email = Buffer.from(payload, "base64url").toString("utf8").trim().toLowerCase();
    if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    return email;
  } catch {
    return null;
  }
}
