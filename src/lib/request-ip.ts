import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

async function clientIp(): Promise<string> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || headerStore.get("x-real-ip")?.trim() || "";
  if (!ip || ip.toLowerCase() === "unknown") return "";
  return ip;
}

export async function requestClientIp(): Promise<string | null> {
  const ip = await clientIp();
  return ip || null;
}

export async function requestIpHash(): Promise<string | null> {
  const ip = await clientIp();
  if (!ip) return null;
  return createHash("sha256").update(`cornhole-news-form-v1|${ip}`).digest("hex");
}
