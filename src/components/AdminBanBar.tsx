"use client";

import { useEffect, useState } from "react";
import BanControl from "@/components/BanControl";
import { createClient } from "@/lib/supabase/client";

/**
 * Ban control for an admin viewing someone else's profile.
 * Loaded in the browser so the public profile page can stay cached.
 */
export default function AdminBanBar({ userId, username }: { userId: string; username: string }) {
  const [banned, setBanned] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active || !user || user.id === userId) return;

      const { data: viewer } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();
      if (!active || !viewer?.is_admin) return;

      const { data: target, error } = await supabase
        .from("profiles")
        .select("is_banned")
        .eq("id", userId)
        .maybeSingle();
      if (!active) return;
      setBanned(error ? false : Boolean(target?.is_banned));
    }

    void load();
    return () => {
      active = false;
    };
  }, [userId]);

  if (banned === null) return null;
  return <BanControl userId={userId} username={username} isBanned={banned} />;
}
