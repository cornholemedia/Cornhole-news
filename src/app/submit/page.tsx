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
  const [generatingTitle, setGeneratingTitle] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/login");
      } else {
        setCheckingAuth(false);
      }
    });
  }, [router, supabase]);

  async function handleGenerateTitle() {
    setError(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Paste a URL first, then generate a title.");
      return;
    }

    setGeneratingTitle(true);
    try {
      const res = await fetch("/api/fetch-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = (await res.json()) as { title?: string; error?: string };
      if (!res.ok || !data.title) {
        setError(data.error || "Could not generate a title from that URL.");
        return;
      }
      setTitle(data.title);
    } catch {
      setError("Could not generate a title from that URL.");
    } finally {
      setGeneratingTitle(false);
    }
  }

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
          <label className="mb-1 block text-sm text-[#666]">URL (optional)</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
              className="w-full rounded border border-[#e0e0e0] px-3 py-2 text-[15px]"
            />
            <button
              type="button"
              onClick={handleGenerateTitle}
              disabled={generatingTitle || !url.trim()}
              className="shrink-0 rounded border border-[#3f679b] px-3 py-2 text-[14px] font-medium text-[#3f679b] hover:bg-[#3f679b]/10 disabled:opacity-60"
            >
              {generatingTitle ? "Generating…" : "Generate title"}
            </button>
          </div>
          <p className="mt-1 text-[12px] text-[#666]">
            For news links, paste the URL and generate a title from the article.
          </p>
        </div>

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
