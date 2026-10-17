import "server-only";
import { FORM_RATE_LIMIT_ERROR, FORM_SAVE_ERROR } from "@/lib/form-fields";
import { createServiceClient } from "@/lib/supabase/service";

export type RateLimitedForm =
  | "contact"
  | "job"
  | "newsletter"
  | "job_posting"
  | "signup"
  | "post"
  | "comment";

let loggedMissingKey = false;

export async function recordIpAttempt(
  form: RateLimitedForm,
  ipHash: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!ipHash) return { ok: true };

  const supabase = createServiceClient();
  if (!supabase) {
    if (!loggedMissingKey) {
      loggedMissingKey = true;
      console.error(
        "SUPABASE_SERVICE_ROLE_KEY is not set. IP rate limits and form saves cannot run. Set it on the server and redeploy."
      );
    }
    return { ok: false, error: FORM_SAVE_ERROR };
  }

  const { data, error } = await supabase.rpc("record_form_attempt", {
    p_form: form,
    p_ip_hash: ipHash,
  });

  if (error) {
    console.error("Could not record a form attempt:", error.message);
    return { ok: false, error: FORM_SAVE_ERROR };
  }

  if (data !== true) return { ok: false, error: FORM_RATE_LIMIT_ERROR };
  return { ok: true };
}
