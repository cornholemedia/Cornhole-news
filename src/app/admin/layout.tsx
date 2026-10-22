import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = pageMeta({
  title: "Admin",
  description: "Edit Cornhole News pages.",
  path: "/admin",
  noIndex: true,
});

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    redirect("/");
  }

  return (
    <div>
      <nav aria-label="Admin" className="mx-auto mb-4 flex w-full max-w-3xl flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href="/admin" className="text-[#3f679b] hover:underline">
          Pages
        </Link>
        <Link href="/admin/review" className="text-[#3f679b] hover:underline">
          Digest
        </Link>
        <Link href="/admin/ads" className="text-[#3f679b] hover:underline">
          Ads
        </Link>
      </nav>
      {children}
    </div>
  );
}
