"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AdminPostControlsProps = {
  postId: number;
  authorId: string;
};

export default function AdminPostControls({
  postId,
  authorId,
}: AdminPostControlsProps) {
  const supabase = createClient();
  const router = useRouter();
  const [canModerate, setCanModerate] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active || !user) {
        if (active) setCanModerate(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!active) return;
      setCanModerate(Boolean(profile?.is_admin) || user.id === authorId);
    }

    load();
    return () => {
      active = false;
    };
  }, [supabase, authorId]);

  if (!canModerate) return null;

  async function handleDelete() {
    if (!window.confirm("Delete this post permanently?")) return;
    setBusy(true);
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    setBusy(false);
    if (error) {
      window.alert(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mt-2 flex gap-3 text-[13px] text-[#666]">
      <Link href={`/item/${postId}/edit`} className="hover:underline">
        edit
      </Link>
      <button
        type="button"
        disabled={busy}
        onClick={handleDelete}
        className="hover:underline disabled:opacity-60"
      >
        {busy ? "deleting..." : "delete"}
      </button>
    </div>
  );
}
