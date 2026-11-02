export type AssuranceLevel = "aal1" | "aal2";

/** Same path rules as safeNextPath in safe-next.ts. */
function safeNextPath(value: string | null | undefined, fallback = "/"): string {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.includes("\\") || value.includes("://")) return fallback;
  return value;
}

/** Admins must enroll before using the rest of /admin. Unset means off. */
export function adminMfaRequired(): boolean {
  return process.env.ADMIN_REQUIRE_MFA === "true";
}

export function normalizeTotpCode(value: string): string | null {
  const code = value.replace(/\s+/g, "");
  return /^\d{6}$/.test(code) ? code : null;
}

export function qrImageSrc(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.startsWith("data:image/")) return trimmed;
  if (trimmed.startsWith("<svg")) {
    return `data:image/svg+xml;utf-8,${encodeURIComponent(trimmed)}`;
  }
  return null;
}

/**
 * Where an admin request under /admin should go. Null means the page can render.
 * A missing assurance reading does not lock anyone out unless enrollment is required.
 */
export function adminMfaRedirect(options: {
  pathname: string;
  search?: string;
  currentLevel: AssuranceLevel | null;
  hasVerifiedFactor: boolean;
  requireEnrollment: boolean;
  assuranceKnown: boolean;
}): string | null {
  const pathname = options.pathname;
  const search = options.search ?? "";

  if (!options.assuranceKnown) {
    if (options.requireEnrollment && pathname !== "/admin/security") return "/admin/security";
    return null;
  }

  const aal2 = options.currentLevel === "aal2";

  if (options.hasVerifiedFactor && !aal2) {
    if (pathname === "/admin/mfa") return null;
    const next = safeNextPath(`${pathname}${search}`, "/admin");
    if (next === "/admin/mfa" || next.startsWith("/admin/mfa?")) return "/admin/mfa";
    return `/admin/mfa?next=${encodeURIComponent(next)}`;
  }

  if (options.requireEnrollment && !options.hasVerifiedFactor) {
    if (pathname === "/admin/security") return null;
    return "/admin/security";
  }

  if (pathname === "/admin/mfa") return mfaContinuePath(search);
  return null;
}

export function mfaContinuePath(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const next = safeNextPath(params.get("next"), "/admin");
  if (next === "/admin/mfa" || next.startsWith("/admin/mfa?")) return "/admin";
  return next;
}

/** After a password sign-in. Enrolled admins finish the authenticator step first. */
export function loginRedirectAfterPassword(options: {
  requestedNext: string;
  isAdmin: boolean;
  currentLevel: AssuranceLevel | null;
  hasVerifiedFactor: boolean;
  requireEnrollment: boolean;
}): string {
  const next = safeNextPath(options.requestedNext);
  if (!options.isAdmin) return next;

  if (options.hasVerifiedFactor && options.currentLevel !== "aal2") {
    const after = next === "/admin/mfa" || next.startsWith("/admin/mfa?") ? "/admin" : next;
    return `/admin/mfa?next=${encodeURIComponent(after)}`;
  }

  if (
    options.requireEnrollment &&
    !options.hasVerifiedFactor &&
    (next === "/admin" || next.startsWith("/admin/"))
  ) {
    return "/admin/security";
  }

  return next;
}
