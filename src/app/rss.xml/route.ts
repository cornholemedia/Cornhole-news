import { rssFeedResponse } from "@/lib/feed-response";
import { RSS_PATH } from "@/lib/rss";

export const revalidate = 300;
export const runtime = "nodejs";

export function GET() {
  return rssFeedResponse(RSS_PATH);
}
