"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SubmitPage() {
  const supabase = createClient();
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/login");
      } else {
        setCheckingAuth(false);
      }
    });
  }, [router, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("posts")
      .insert({
        title: title.trim(),
        url: url.trim() || null,
        body: body.trim() || null,
        author_id: user.id,
      })
      .select("id")
      .single();

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push(`/item/${data.id}`);
    router.refresh();
  }

  if (checkingAuth) return null;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-4 text-2xl font-bold">Submit</h1>
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
            placeholder="https://"
            className="w-full rounded border border-[#e0e0e0] px-3 py-2 text-[15px]"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-[#666]">
            Text (optional, for a discussion post instead of a link)
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className="w-full rounded border border-[#e0e0e0] px-3 py-2 text-[15px]"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-[#3f679b] px-4 py-2 text-[15px] font-medium text-white hover:bg-[#345580] disabled:opacity-60"
        >
          {loading ? "Submitting..." : "Submit"}
        </button>
      </form>
    </div>
  );
}
