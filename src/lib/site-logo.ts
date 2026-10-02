import fs from "node:fs";
import path from "node:path";
import { SITE_LOGO_SRC } from "@/lib/site";

const PUBLIC_LOGO_FILES = ["logo.svg", "logo.png", "logo.webp", "logo.jpg", "logo.jpeg"];

/** Accepts a same-site path such as "/logo.png". Rejects external and relative URLs. */
function localLogoPath(value: string): string | null {
  const configured = value.trim();
  if (!configured) return null;
  if (
    configured.startsWith("/") &&
    !configured.startsWith("//") &&
    !configured.includes("\\") &&
    !configured.includes("..")
  ) {
    return configured;
  }
  return null;
}

/**
 * Logo URL for the header, or null when none is configured.
 * An explicit path wins. Otherwise the first matching file in /public is used.
 */
export function getSiteLogoSrc(): string | null {
  const explicit = localLogoPath(process.env.NEXT_PUBLIC_SITE_LOGO ?? "") ?? localLogoPath(SITE_LOGO_SRC);
  if (explicit) return explicit;

  const publicDir = path.join(process.cwd(), "public");
  for (const filename of PUBLIC_LOGO_FILES) {
    if (fs.existsSync(path.join(publicDir, filename))) {
      return `/${filename}`;
    }
  }

  return null;
}
