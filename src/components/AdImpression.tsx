"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AdImpression({ id }: { id: string }) {
  useEffect(() => {
    const supabase = createClient();
    void supabase.rpc("increment_ad_impression", { p_id: id });
  }, [id]);

  return null;
}
