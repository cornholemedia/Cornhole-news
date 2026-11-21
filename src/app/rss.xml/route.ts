import { rssFeedResponse } from "@/lib/rss-response";

// Three minutes. Keep this number in step with RSS_REVALIDATE_SECONDS.
// Next.js only accepts a literal here.
export const revalidate = 180;

export function GET() {
  return rssFeedResponse();
}
