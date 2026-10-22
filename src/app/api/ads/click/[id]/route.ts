import { NextResponse } from "next/server";
import { isAdId, safeAdClickUrl } from "@/lib/ads";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function missing(status = 404) {
  return new NextResponse("Not found", {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!isAdId(id) || !isSupabaseConfigured()) return missing();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_ad_click", { p_id: id });
  const destination = safeAdClickUrl(data);
  if (error || !destination) return missing();

  const response = NextResponse.redirect(destination, 302);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
