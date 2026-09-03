"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type VoteButtonProps = {
  postId: number;
};

export default function VoteButton({ postId }: VoteButtonProps) {
  const supabase = createClient();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      setUserId(user?.id ?? null);

      if (user) {
        const { data } = await supabase
          .from("votes")
          .select("post_id")
          .eq("post_id", postId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (active) setVoted(!!data);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [postId, supabase]);

  async function handleClick() {
    if (!userId) {
      router.push("/login");
      return;
    }

    startTransition(async () => {
      if (voted) {
        await supabase.from("votes").delete().eq("post_id", postId).eq("user_id", userId);
        setVoted(false);
      } else {
        await supabase.from("votes").insert({ post_id: postId, user_id: userId });
        setVoted(true);
      }
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      aria-label={voted ? "Remove upvote" : "Upvote"}
      className={`mt-0.5 text-[13px] leading-none ${
        voted ? "text-[#ff6600]" : "text-[#999] hover:text-[#ff6600]"
      }`}
      title={voted ? "Remove your upvote" : "Upvote"}
    >
      ▲
    </button>
  );
}
