/** Canonical production origin. www.cornholenews.news redirects here. */
export const CANONICAL_SITE_URL = "https://cornholenews.news";

export const SITE_NAME = "Cornhole News";

/**
 * Optional logo shown beside the site title.
 * Leave this empty to hide the logo. A file named logo.svg, logo.png,
 * logo.webp, logo.jpg, or logo.jpeg in /public is used automatically.
 * Or set this to a public path such as "/logo.png".
 * NEXT_PUBLIC_SITE_LOGO overrides this value when it is set.
 */
export const SITE_LOGO_SRC = "";

export const DEFAULT_DESCRIPTION =
  "News and discussion for the 12 Midwestern states.";

/**
 * Public site origin used in metadata, the sitemap, and the title-fetcher
 * user agent. Set NEXT_PUBLIC_SITE_URL to override the canonical domain.
 */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return CANONICAL_SITE_URL;

  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return CANONICAL_SITE_URL;
    }
    return url.origin;
  } catch {
    return CANONICAL_SITE_URL;
  }
}

/** Dashed ad boxes stay hidden until this server env var is exactly "true". */
export function adsEnabled(): boolean {
  return process.env.SHOW_ADS === "true";
}
