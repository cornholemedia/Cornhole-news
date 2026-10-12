import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SHOW_POLITICS_COOKIE, parseShowPolitics } from "@/lib/show-politics";

/**
 * Home-feed preference.
 * This browser's cookie wins. If it has never chosen, a signed-in reader's
 * saved profile setting is used. Otherwise every post is shown.
 */
export async function resolveShowPolitics(): Promise<boolean> {
  const cookieStore = await cookies();
  const fromCookie = parseShowPolitics(cookieStore.get(SHOW_POLITICS_COOKIE)?.value);
  if (fromCookie !== null) return fromCookie;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return true;

  const { data, error } = await supabase
    .from("profiles")
    .select("show_politics")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data || typeof data.show_politics !== "boolean") return true;
  return data.show_politics;
}
