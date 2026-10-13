import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PLACEHOLDER_SUPABASE_URL } from "@/lib/supabase/config";

/**
 * Service-role client for the digest ingest route. Never import this from a
 * Client Component. The key is read from SUPABASE_SERVICE_ROLE_KEY, which must
 * not use a NEXT_PUBLIC_ name.
 */
export function createServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  if (url === PLACEHOLDER_SUPABASE_URL) return null;
  if (key.startsWith("sb_publishable_")) return null;

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (anonKey && key === anonKey) return null;

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
