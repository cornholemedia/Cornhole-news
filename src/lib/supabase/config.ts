export const PLACEHOLDER_SUPABASE_URL = "https://placeholder.supabase.co";
export const PLACEHOLDER_SUPABASE_KEY = "public-anon-key";

/** True only when a real project URL and anon key are set. */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return false;
  if (url === PLACEHOLDER_SUPABASE_URL || key === PLACEHOLDER_SUPABASE_KEY) return false;
  return true;
}
