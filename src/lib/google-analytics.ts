export const GA_MEASUREMENT_ID_FALLBACK = "G-XR4ECDH5BR";

const LOCATION_PARAMS = ["dl", "dp", "ep.page_location", "page_location"];

export function gaMeasurementId(
  env: string | undefined = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
): string {
  const configured = env?.trim();
  return configured || GA_MEASUREMENT_ID_FALLBACK;
}

/** Public pages are tracked. /admin and everything under it is not. */
export function isTrackedPath(pathname: string): boolean {
  const path = pathname.split(/[?#]/, 1)[0] || "/";
  return path !== "/admin" && !path.startsWith("/admin/");
}

export function isGoogleAnalyticsCollectUrl(url: string): boolean {
  try {
    const parsed = new URL(url, "https://cornholenews.news");
    const host = parsed.hostname;
    const analyticsHost =
      host === "google-analytics.com" ||
      host.endsWith(".google-analytics.com") ||
      host === "analytics.google.com" ||
      host.endsWith(".analytics.google.com");
    return analyticsHost && parsed.pathname.includes("collect");
  } catch {
    return false;
  }
}

function locationIsAdmin(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/")) return !isTrackedPath(trimmed);
  try {
    return !isTrackedPath(new URL(trimmed).pathname);
  } catch {
    return false;
  }
}

function paramsTargetAdmin(params: URLSearchParams): boolean {
  for (const name of LOCATION_PARAMS) {
    for (const value of params.getAll(name)) {
      if (locationIsAdmin(value)) return true;
    }
  }
  return false;
}

/**
 * True when a GA collect hit is for an /admin URL.
 * Client navigations fire this hit from the gtag history listener before React
 * can unmount the tag, so the page path has to be checked on the request.
 */
export function analyticsCollectTargetsAdmin(url: string, body: string | null | undefined): boolean {
  try {
    if (paramsTargetAdmin(new URL(url, "https://cornholenews.news").searchParams)) return true;
  } catch {
    return false;
  }
  if (!body) return false;
  const query = body.trim().replace(/^\?/, "");
  return paramsTargetAdmin(new URLSearchParams(query));
}
