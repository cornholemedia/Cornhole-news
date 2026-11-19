import { rssFeedResponse } from "@/lib/rss-response";

// Five minutes. Keep this in step with RSS_REVALIDATE_SECONDS.
export const revalidate = 300;

export function GET() {
  return rssFeedResponse();
}
