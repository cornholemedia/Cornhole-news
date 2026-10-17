const POST_URL_MAX = 2000;
const POST_BODY_MAX = 10000;
const POST_TITLE_MAX = 300;

export { POST_BODY_MAX, POST_TITLE_MAX, POST_URL_MAX };

export function safePostUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (raw.length < 8 || raw.length > POST_URL_MAX) return null;
  if (/[\s\u0000-\u001f\u007f]/.test(raw)) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function postLinkHost(value: string | null | undefined): string | null {
  const safe = safePostUrl(value);
  if (!safe) return null;
  try {
    return new URL(safe).hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}

export function cleanPostTitle(value: string): string | null {
  const title = value.replace(/\r\n/g, "\n").trim();
  if (!title || title.length > POST_TITLE_MAX) return null;
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(title)) return null;
  if (/[\r\n]/.test(title)) return null;
  return title;
}

export function cleanPostBody(value: string): string | null {
  const body = value.replace(/\r\n/g, "\n").trim();
  if (!body) return "";
  if (body.length > POST_BODY_MAX) return null;
  if (body.includes("\u0000")) return null;
  return body;
}

export function friendlyWriteError(message: string): string {
  if (/suspended/i.test(message)) return "This account is suspended.";
  if (/several stories|too many stories|several comments|too many comments/i.test(message)) {
    return message;
  }
  if (/posts_url_format_check/i.test(message)) return "Enter a valid http or https link.";
  if (/posts_body_length_check/i.test(message)) {
    return "The text must be 10,000 characters or fewer.";
  }
  return "Could not save that. Please try again.";
}
