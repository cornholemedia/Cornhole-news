/** Front page and /new. New stories also refresh as soon as they are published. */
export const FEED_REVALIDATE_SECONDS = 180;

/** Stories, jobs, profiles, and editable pages. Edits refresh on demand. */
export const DOCUMENT_REVALIDATE_SECONDS = 3600;

/** Sitemap. Publishing a story refreshes it on demand as well. */
export const SITEMAP_REVALIDATE_SECONDS = 3600;
