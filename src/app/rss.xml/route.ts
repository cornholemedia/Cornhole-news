import { RSS_REVALIDATE_SECONDS } from "@/lib/rss";
import { rssFeedResponse } from "@/lib/rss-response";

export const revalidate = RSS_REVALIDATE_SECONDS;

export function GET() {
  return rssFeedResponse();
}
