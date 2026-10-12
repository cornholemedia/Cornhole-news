export const SHOW_POLITICS_COOKIE = "show_politics";
export const SHOW_POLITICS_STORAGE_KEY = "cornhole.showPolitics";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** "1" shows political posts. "0" hides them. Anything else is unset. */
export function parseShowPolitics(value: string | null | undefined): boolean | null {
  if (value === "1") return true;
  if (value === "0") return false;
  return null;
}

export function readShowPoliticsCookie(): boolean | null {
  if (typeof document === "undefined") return null;
  const prefix = `${SHOW_POLITICS_COOKIE}=`;
  const match = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  if (!match) return null;
  return parseShowPolitics(decodeURIComponent(match.slice(prefix.length)));
}

/** Mirrors the browser's saved choice so the home page can filter before it limits the list. */
export function writeShowPoliticsCookie(show: boolean) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SHOW_POLITICS_COOKIE}=${show ? "1" : "0"}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}
