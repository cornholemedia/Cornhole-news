import "server-only";

import { adminMfaRequired, type AssuranceLevel } from "@/lib/admin-mfa";
import { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type AdminAssurance = {
  currentLevel: AssuranceLevel | null;
  hasVerifiedFactor: boolean;
  assuranceKnown: boolean;
};

export async function readAdminAssurance(supabase: ServerClient): Promise<AdminAssurance> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) {
    console.error(
      "Could not read authenticator assurance:",
      error?.message ?? "no assurance level"
    );
    return { currentLevel: null, hasVerifiedFactor: false, assuranceKnown: false };
  }

  return {
    currentLevel: data.currentLevel === "aal2" ? "aal2" : "aal1",
    hasVerifiedFactor: data.nextLevel === "aal2",
    assuranceKnown: true,
  };
}

const SIGN_IN = "Sign in as an admin to do that.";
const NEED_ADMIN = "You need an admin account to do that.";
const NEED_CODE = "Enter the code from your authenticator app.";
const NEED_SETUP = "Set up an authenticator app before doing that.";

export async function adminClient(): Promise<
  | { supabase: ServerClient; error: null }
  | { supabase: null; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase: null, error: SIGN_IN };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) return { supabase: null, error: NEED_ADMIN };

  const assurance = await readAdminAssurance(supabase);
  if (!assurance.assuranceKnown) {
    if (adminMfaRequired()) return { supabase: null, error: NEED_SETUP };
    return { supabase, error: null };
  }
  if (assurance.hasVerifiedFactor && assurance.currentLevel !== "aal2") {
    return { supabase: null, error: NEED_CODE };
  }
  if (adminMfaRequired() && !assurance.hasVerifiedFactor) {
    return { supabase: null, error: NEED_SETUP };
  }

  return { supabase, error: null };
}
