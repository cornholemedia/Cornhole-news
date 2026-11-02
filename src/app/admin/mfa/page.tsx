import type { Metadata } from "next";
import AdminMfaChallenge from "@/components/AdminMfaChallenge";
import { mfaContinuePath } from "@/lib/admin-mfa";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Authenticator code",
  description: "Enter the code from your authenticator app.",
  path: "/admin/mfa",
  noIndex: true,
});

export default async function AdminMfaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = mfaContinuePath(next ? `?next=${encodeURIComponent(next)}` : "");

  return <AdminMfaChallenge nextPath={nextPath} />;
}
