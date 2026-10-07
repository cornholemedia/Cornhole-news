import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

export async function requestIpHash(): Promise<string | null> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || headerStore.get("x-real-ip")?.trim() || "";
  if (!ip || ip.toLowerCase() === "unknown") return null;

  return createHash("sha256").update(`cornhole-news-form-v1|${ip}`).digest("hex");
}
