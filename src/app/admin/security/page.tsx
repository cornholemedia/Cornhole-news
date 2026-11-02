import type { Metadata } from "next";
import AdminMfaSetup from "@/components/AdminMfaSetup";
import { adminMfaRequired } from "@/lib/admin-mfa";
import { pageMeta } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Admin security",
  description: "Set up an authenticator app for an admin account.",
  path: "/admin/security",
  noIndex: true,
});

export default async function AdminSecurityPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  const factors = (data?.totp ?? [])
    .filter((factor) => factor.status === "verified")
    .map((factor) => ({
      id: factor.id,
      friendlyName: factor.friendly_name?.trim() || "Authenticator app",
    }));

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold">Security</h1>
      <p className="mb-6 text-[15px] leading-relaxed text-[#666]">
        Add an authenticator app to this admin account. After it is on, signing in
        asks for a 6-digit code. Leave <code>ADMIN_REQUIRE_MFA</code> unset until
        that app is working, then set it to <code>true</code> so every admin has to
        enroll.
      </p>
      {error ? (
        <p role="alert" className="mb-4 text-sm text-red-700">
          Could not load authenticator apps. {error.message}
        </p>
      ) : (
        <AdminMfaSetup factors={factors} requireEnrollment={adminMfaRequired()} />
      )}
    </div>
  );
}
