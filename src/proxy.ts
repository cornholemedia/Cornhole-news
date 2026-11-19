import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Admin session refresh and the admin gate. Every matched request invokes
  // this function before the cache, so public pages, feeds, and files stay out.
  matcher: ["/admin", "/admin/:path*"],
};
