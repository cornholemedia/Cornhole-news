import { createBrowserClient } from "@supabase/ssr";

// Static pages render the header during `next build`. The client must be
// constructable even when preview env vars are not present yet. Real values
// are used whenever they are set.
const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_KEY = "public-anon-key";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_KEY
  );
}
