import { createBrowserClient } from "@supabase/ssr";
import { PLACEHOLDER_SUPABASE_KEY, PLACEHOLDER_SUPABASE_URL } from "@/lib/supabase/config";

// Static pages render the header during `next build`. The client must be
// constructable even when preview env vars are not present yet. Real values
// are used whenever they are set.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_SUPABASE_KEY
  );
}
