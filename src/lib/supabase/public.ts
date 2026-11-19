import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { FEED_REVALIDATE_SECONDS } from "@/lib/rss";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Cookieless client for public, anonymous reads. Uses the anon key so row
 * level security still applies. Do not use this for user-specific data, and
 * do not read the service role key here.
 */
export function createPublicClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key || !isSupabaseConfigured()) return null;

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          cache: "force-cache",
          next: { revalidate: FEED_REVALIDATE_SECONDS },
        } as RequestInit & { next?: { revalidate: number } }),
    },
  });
}
