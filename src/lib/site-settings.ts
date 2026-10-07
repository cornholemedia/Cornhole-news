import "server-only";
import { cleanEmail } from "@/lib/form-fields";
import {
  CONTACT_RECIPIENT_KEY,
  DEFAULT_RECIPIENT_EMAIL,
  JOBS_RECIPIENT_KEY,
} from "@/lib/setting-keys";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export { CONTACT_RECIPIENT_KEY, DEFAULT_RECIPIENT_EMAIL, JOBS_RECIPIENT_KEY };

const DEFAULTS = {
  [CONTACT_RECIPIENT_KEY]: DEFAULT_RECIPIENT_EMAIL,
  [JOBS_RECIPIENT_KEY]: DEFAULT_RECIPIENT_EMAIL,
} as const;

export type SettingKey = keyof typeof DEFAULTS;

export async function recipientEmail(key: SettingKey): Promise<string> {
  if (!isSupabaseConfigured()) return DEFAULTS[key];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("form_recipient_email", { p_key: key });

  if (error) {
    console.warn(`Could not read site setting ${key}:`, error.message);
    return DEFAULTS[key];
  }

  const email = typeof data === "string" ? cleanEmail(data) : null;
  return email ?? DEFAULTS[key];
}

export type AdminSiteSettings = {
  contactEmail: string;
  jobsEmail: string;
  stored: boolean;
  loadError: string | null;
};

export async function getSiteSettingsForAdmin(): Promise<AdminSiteSettings> {
  const fallback: AdminSiteSettings = {
    contactEmail: DEFAULT_RECIPIENT_EMAIL,
    jobsEmail: DEFAULT_RECIPIENT_EMAIL,
    stored: false,
    loadError: null,
  };

  if (!isSupabaseConfigured()) return fallback;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", [CONTACT_RECIPIENT_KEY, JOBS_RECIPIENT_KEY]);

    if (error) {
      console.error("Error fetching site settings:", error.message);
      return {
        ...fallback,
        loadError: error.message,
      };
    }

    const rows = data ?? [];
    const contact = rows.find((row) => row.key === CONTACT_RECIPIENT_KEY)?.value;
    const jobs = rows.find((row) => row.key === JOBS_RECIPIENT_KEY)?.value;

    return {
      contactEmail: typeof contact === "string" && contact ? contact : fallback.contactEmail,
      jobsEmail: typeof jobs === "string" && jobs ? jobs : fallback.jobsEmail,
      stored: rows.length > 0,
      loadError: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load settings.";
    console.error("Error fetching site settings:", message);
    return { ...fallback, loadError: message };
  }
}
