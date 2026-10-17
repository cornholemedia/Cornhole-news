"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import TurnstileField from "@/components/TurnstileField";
import { submitComment } from "@/app/comments/actions";
import { formatTimeAgo } from "@/lib/time";

type Comment = {
  id: number;
  body: string;
  created_at: string;
  author_id: string;
  author_username: string;
};

export default function Comments({ postId }: { postId: number }) {
  const supabase = createClient();
  const router = useRouter();
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileKey, setTurnstileKey] = useState(0);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!active) return;
      setUserId(user?.id ?? null);
      if (!user) {
        setIsAdmin(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();
      if (active) setIsAdmin(Boolean(profile?.is_admin));
    });
    loadComments();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  async function loadComments() {
    const { data, error } = await supabase
      .from("comments")
      .select("id, body, created_at, author_id, profiles(username)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setComments(
        data.map((c) => {
          const profile = c.profiles as unknown as { username: string } | { username: string }[] | null;
          const username = Array.isArray(profile) ? profile[0]?.username : profile?.username;
          return {
            id: c.id,
            body: c.body,
            created_at: c.created_at,
            author_id: c.author_id,
            author_username: username ?? "unknown",
          };
        })
      );
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!userId) {
      router.push("/login");
      return;
    }
    if (!body.trim()) return;

    setLoading(true);
    const result = await submitComment(new FormData(e.currentTarget));
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      setTurnstileKey((key) => key + 1);
      return;
    }

    setBody("");
    setTurnstileKey((key) => key + 1);
    loadComments();
  }

  async function deleteComment(commentId: number) {
    if (!window.confirm("Delete this comment permanently?")) return;
    const { error: deleteError } = await supabase.from("comments").delete().eq("id", commentId);
    if (deleteError) {
      window.alert(deleteError.message);
      return;
    }
    loadComments();
  }

  return (
    <div className="mt-6">
      <h2 className="mb-3 text-sm font-semibold text-[#666]">
        {comments.length} {comments.length === 1 ? "comment" : "comments"}
      </h2>

      <form onSubmit={handleSubmit} className="mb-6">
        <input type="hidden" name="postId" value={postId} />
        <textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={userId ? "Add a comment..." : "Log in to comment"}
          aria-label={userId ? "Add a comment" : "Log in to comment"}
          disabled={!userId}
          rows={3}
          maxLength={5000}
          className="field-input"
        />
        {userId ? <div className="mt-2"><TurnstileField resetKey={String(turnstileKey)} /></div> : null}
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        <div className="mt-2">
          {userId ? (
            <button
              type="submit"
              disabled={loading}
              className="field-button rounded bg-[#3f679b] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#345580] disabled:opacity-60"
            >
              {loading ? "Posting..." : "Add comment"}
            </button>
          ) : (
            <Link href="/login" className="text-sm text-[#3f679b] hover:underline">
              Log in to comment
            </Link>
          )}
        </div>
      </form>

      <div className="space-y-4">
        {comments.map((c) => (
          <div key={c.id} className="border-l-2 border-[#e0e0e0] pl-3">
            <div className="text-[13px] text-[#666]">
              <Link href={`/user/${c.author_username}`} className="font-medium hover:underline">
                {c.author_username}
              </Link>{" "}
              {formatTimeAgo(c.created_at)}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-[14px] text-black">{c.body}</p>
            {userId && (isAdmin || userId === c.author_id) ? (
              <button
                type="button"
                onClick={() => deleteComment(c.id)}
                className="mt-1 text-[13px] text-[#666] hover:underline"
              >
                delete
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
