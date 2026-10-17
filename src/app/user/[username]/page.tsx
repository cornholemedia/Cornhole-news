import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import BanControl from "@/components/BanControl";
import PostList from "@/components/PostList";
import { pageMeta } from "@/lib/seo";

export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const name = decodeURIComponent(username);

  return pageMeta({
    title: name,
    description: `Stories submitted by ${name} on Cornhole News.`,
    path: `/user/${encodeURIComponent(name)}`,
  });
}

export default async function UserPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile:
    | { id: string; username: string; created_at: string; is_banned?: boolean }
    | null = null;
  let viewerIsAdmin = false;

  const withBan = await supabase
    .from("profiles")
    .select("id, username, created_at, is_banned")
    .eq("username", username)
    .maybeSingle();

  if (withBan.error && /is_banned/i.test(withBan.error.message)) {
    const fallback = await supabase
      .from("profiles")
      .select("id, username, created_at")
      .eq("username", username)
      .maybeSingle();
    profile = fallback.data;
  } else {
    profile = withBan.data;
  }

  if (!profile) {
    return <p className="text-[15px] text-[#666]">User not found.</p>;
  }

  if (user) {
    const { data: viewer } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    viewerIsAdmin = Boolean(viewer?.is_admin) && user.id !== profile.id;
  }

  const { data: posts } = await supabase
    .from("posts_with_stats")
    .select("*")
    .eq("author_id", profile.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">{profile.username}</h1>
      <p className="mb-4 text-sm text-[#666]">
        joined {new Date(profile.created_at).toLocaleDateString()}
        {profile.is_banned ? " · suspended" : ""}
      </p>
      {viewerIsAdmin ? (
        <BanControl
          userId={profile.id}
          username={profile.username}
          isBanned={Boolean(profile.is_banned)}
        />
      ) : null}

      <h2 className="mb-2 text-sm font-semibold text-[#666]">Submissions</h2>
      <PostList posts={posts ?? []} emptyMessage="No submissions yet." />
    </div>
  );
}
