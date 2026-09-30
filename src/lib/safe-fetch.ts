import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { getSiteUrl } from "@/lib/site";

const MAX_REDIRECTS = 5;

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return true;

  const nums = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) return Number.NaN;
    return Number(part);
  });
  if (nums.some((n) => Number.isNaN(n) || n > 255)) return true;

  const [a, b, c] = nums;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIp(ip: string): boolean {
  const normalized = ip.toLowerCase().split("%")[0];

  if (normalized.includes(":")) {
    if (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80") ||
      normalized.startsWith("ff")
    ) {
      return true;
    }

    if (normalized.startsWith("::ffff:")) {
      const embedded = normalized.slice("::ffff:".length);
      if (embedded.includes(".")) return isPrivateIpv4(embedded);
      return true;
    }

    return false;
  }

  return isPrivateIpv4(normalized);
}

function canonicalHostname(hostname: string): string {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host.startsWith("[") && host.endsWith("]")) return host.slice(1, -1);
  return host;
}

function isBlockedHostname(hostname: string): boolean {
  const host = canonicalHostname(hostname);
  if (!host || host.includes("%")) return true;
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal" ||
    host === "0.0.0.0"
  ) {
    return true;
  }

  // Decimal and hex forms (for example 2130706433 or 0x7f000001) skip the
  // dotted-quad check and can point at loopback.
  if (/^\d+$/.test(host) || /^0x[0-9a-f]+$/i.test(host)) return true;

  // Short or octal-looking IPv4 (127.1, 0177.0.0.1) is not a public host.
  if (/^\d+(\.\d+){1,3}$/.test(host)) {
    if (!isIP(host)) return true;
    const parts = host.split(".");
    if (parts.some((part) => part.length > 1 && part.startsWith("0"))) return true;
  }

  return false;
}

export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Enter a valid URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("That URL is not allowed.");
  }

  const hostname = canonicalHostname(parsed.hostname);
  if (isBlockedHostname(hostname)) {
    throw new Error("That URL is not allowed.");
  }

  const literal = isIP(hostname);
  if (literal) {
    if (isPrivateIp(hostname)) {
      throw new Error("That URL is not allowed.");
    }
    return parsed;
  }

  let records: { address: string }[];
  try {
    records = await lookup(hostname, { all: true });
  } catch {
    throw new Error("Could not resolve that host.");
  }

  if (!records.length) {
    throw new Error("Could not resolve that host.");
  }

  for (const record of records) {
    if (isPrivateIp(record.address)) {
      throw new Error("That URL is not allowed.");
    }
  }

  return parsed;
}

/**
 * Fetch a public page without letting a redirect hop land on a blocked address.
 * Each Location is resolved and checked before the next request.
 */
export async function fetchPublicHtml(rawUrl: string, signal: AbortSignal): Promise<Response> {
  let current = await assertPublicHttpUrl(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetch(current.toString(), {
      method: "GET",
      redirect: "manual",
      signal,
      headers: {
        "User-Agent": `CornholeNewsTitleBot/1.0 (+${getSiteUrl()})`,
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (response.status < 300 || response.status >= 400) {
      return response;
    }

    const location = response.headers.get("location");
    await response.body?.cancel().catch(() => undefined);

    if (hop === MAX_REDIRECTS) {
      throw new Error("Too many redirects.");
    }
    if (!location) {
      throw new Error("That page redirected without a destination.");
    }

    let next: URL;
    try {
      next = new URL(location, current);
    } catch {
      throw new Error("That page redirected to an invalid URL.");
    }

    current = await assertPublicHttpUrl(next.toString());
  }

  throw new Error("Too many redirects.");
}
