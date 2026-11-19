import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  PLACEHOLDER_SUPABASE_KEY,
  PLACEHOLDER_SUPABASE_URL,
  isSupabaseConfigured,
} from "@/lib/supabase/config";

/**
 * Anonymous read of public tables.
 * This client does not touch cookies, so a page that only uses it can be cached.
 * The anon key is already public. Do not pass the service role key here.
 */
export function createPublicClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  if (url === PLACEHOLDER_SUPABASE_URL || key === PLACEHOLDER_SUPABASE_KEY) return null;

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
