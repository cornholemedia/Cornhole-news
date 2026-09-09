"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PostRow = {
  id: number;
  title: string;
  url: string | null;
  body: string | null;
  author_id: string;
};

export default function EditPostPage() {
  const params = useParams<{ id: string }>();
  const postId = Number(params.id);
  const supabase = createClient();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        router.replace("/login");
        return;
      }

      const [{ data: profile }, { data: post, error: postError }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("is_admin")
            .eq("id", user.id)
            .single(),
          supabase
            .from("posts")
            .select("id, title, url, body, author_id")
            .eq("id", postId)
            .single(),
        ]);

      if (!active) return;

      if (postError || !post) {
        setError(postError?.message ?? "Post not found");
        setLoading(false);
        return;
      }

      const row = post as PostRow;
      const isAdmin = Boolean(profile?.is_admin);
      if (!isAdmin && row.author_id !== user.id) {
        setError("You do not have permission to edit this post.");
        setAllowed(false);
        setLoading(false);
        return;
      }

      setTitle(row.title);
      setUrl(row.url ?? "");
      setBody(row.body ?? "");
      setAllowed(true);
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [supabase, postId, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      title: title.trim(),
      url: url.trim() || null,
      body: body.trim() || null,
    };

    const { error: updateError } = await supabase
      .from("posts")
      .update(payload)
      .eq("id", postId);

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push(`/item/${postId}`);
    router.refresh();
  }

  if (loading) {
    return <p className="text-[15px] text-[#666]">Loading…</p>;
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg">
        <p className="text-sm text-red-600">{error ?? "Not allowed"}</p>
        <Link href="/" className="mt-4 inline-block text-[#3f679b] hover:underline">
          ← Back to Top
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-2xl font-bold">Edit post</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm text-[#666]">Title</label>
          <input
            type="text"
            required
            maxLength={300}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded border border-[#e0e0e0] px-3 py-2 text-[15px]"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-[#666]">URL (optional)</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full rounded border border-[#e0e0e0] px-3 py-2 text-[15px]"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-[#666]">Text (optional)</label>
          <textarea
            rows={6}
            maxLength={5000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full rounded border border-[#e0e0e0] px-3 py-2 text-[15px]"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-[#3f679b] px-4 py-2 text-[15px] font-medium text-white hover:bg-[#345580] disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <Link href={`/item/${postId}`} className="text-sm text-[#3f679b] hover:underline">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
