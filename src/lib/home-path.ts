/** Deep pages past this are not real listings. Keeps stray crawlers from minting cache entries. */
export const HOME_PAGE_MAX = 20;

/** Public URL for one Top page. Page 1 is `/` or `/no-politics`. */
export function homeHref(page: number, showPolitics: boolean): string {
  const safe = Number.isInteger(page) && page > 1 ? Math.min(page, HOME_PAGE_MAX) : 1;
  if (showPolitics) return safe === 1 ? "/" : `/p/${safe}`;
  return safe === 1 ? "/no-politics" : `/no-politics/p/${safe}`;
}

/**
 * Page number from a `/p/[page]` segment.
 * `1` is the first page (the route redirects to `/`). Anything else invalid is null.
 */
export function parseHomePageParam(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const page = Number(value);
  if (!Number.isSafeInteger(page) || page < 1 || page > HOME_PAGE_MAX) return null;
  return page;
}
