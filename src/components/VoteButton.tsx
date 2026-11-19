"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { POINTS_EVENT } from "@/lib/points-event";
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
  const initialVoted = useRef<boolean | null>(null);

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
        if (active) {
          const already = !!data;
          setVoted(already);
          if (initialVoted.current === null) initialVoted.current = already;
        }
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
      const nextVoted = !voted;
      if (voted) {
        const { error } = await supabase.from("votes").delete().eq("post_id", postId).eq("user_id", userId);
        if (error) {
          window.alert(error.message);
          return;
        }
        setVoted(false);
      } else {
        const { error } = await supabase.from("votes").insert({ post_id: postId, user_id: userId });
        if (error) {
          window.alert(
            /suspended/i.test(error.message) ? "This account is suspended." : error.message
          );
          return;
        }
        setVoted(true);
      }
      const initial = initialVoted.current;
      if (initial !== null) {
        const delta = (nextVoted ? 1 : 0) - (initial ? 1 : 0);
        window.dispatchEvent(new CustomEvent(POINTS_EVENT, { detail: { postId, delta } }));
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      aria-label={voted ? "Remove upvote" : "Upvote"}
      className={`vote-arrow mt-0.5 text-[13px] leading-none ${voted ? "is-voted" : ""}`}
      title={voted ? "Remove your upvote" : "Upvote"}
    >
      ▲
    </button>
  );
}
