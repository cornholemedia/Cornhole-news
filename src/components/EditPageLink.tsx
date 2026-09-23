"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PageSlug } from "@/lib/page-content";

export default function EditPageLink({ slug }: { slug: PageSlug }) {
  const supabase = createClient();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active || !user) {
        if (active) setIsAdmin(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (active) setIsAdmin(Boolean(profile?.is_admin));
    }

    load();
    return () => {
      active = false;
    };
  }, [supabase]);

  if (!isAdmin) return null;

  return (
    <p className="mt-6 text-[13px] text-[#666]">
      <Link href={`/admin/pages/${slug}`} className="hover:underline">
        edit this page
      </Link>
    </p>
  );
}
