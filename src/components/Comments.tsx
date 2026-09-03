"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null));
    loadComments();
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!userId) {
      router.push("/login");
      return;
    }
    if (!body.trim()) return;

    setLoading(true);
    const { error } = await supabase.from("comments").insert({
      post_id: postId,
      author_id: userId,
      body: body.trim(),
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setBody("");
    loadComments();
  }

  return (
    <div className="mt-6">
      <h2 className="mb-3 text-sm font-semibold text-[#666]">
        {comments.length} {comments.length === 1 ? "comment" : "comments"}
      </h2>

      <form onSubmit={handleSubmit} className="mb-6">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={userId ? "Add a comment..." : "Log in to comment"}
          disabled={!userId}
          rows={3}
          className="w-full rounded border border-[#e0e0e0] px-3 py-2 text-[15px] disabled:bg-gray-50"
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        <div className="mt-2">
          {userId ? (
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-[#3f679b] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#345580] disabled:opacity-60"
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
          </div>
        ))}
      </div>
    </div>
  );
}
