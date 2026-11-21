/**
 * Home, New, story pages, profiles, later home pages, and feeds.
 * A scheduled story stays out of these queries until its release time.
 * Hobby cron runs once a day, so the page itself has to be regenerated
 * within a few minutes of that time. The first story in a batch also
 * refreshes these paths immediately when it is published.
 * Jobs and editable pages stay on DOCUMENT_REVALIDATE_SECONDS.
 */
export const FEED_REVALIDATE_SECONDS = 180;

/** Jobs and editable pages. Edits refresh on demand. Story lists use the shorter window above. */
export const DOCUMENT_REVALIDATE_SECONDS = 3600;

/**
 * Sitemap. A drip story is omitted until it is public, and publishing only
 * refreshes the sitemap for stories that are already due. A few minutes
 * lets the later slots appear without a per-minute cron.
 */
export const SITEMAP_REVALIDATE_SECONDS = 180;
