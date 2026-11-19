import type { Metadata } from "next";
import AdminBanBar from "@/components/AdminBanBar";
import PostList from "@/components/PostList";
import { pageMeta } from "@/lib/seo";
import { createPublicClient } from "@/lib/supabase/public";

export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

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
  const name = decodeURIComponent(username);
  const supabase = createPublicClient();
  if (!supabase) {
    return <p className="text-[15px] text-[#666]">User not found.</p>;
  }

  let profile:
    | { id: string; username: string; created_at: string; is_banned?: boolean }
    | null = null;

  const withBan = await supabase
    .from("profiles")
    .select("id, username, created_at, is_banned")
    .eq("username", name)
    .maybeSingle();

  if (withBan.error && /is_banned/i.test(withBan.error.message)) {
    const fallback = await supabase
      .from("profiles")
      .select("id, username, created_at")
      .eq("username", name)
      .maybeSingle();
    profile = fallback.data;
  } else {
    profile = withBan.data;
  }

  if (!profile) {
    return <p className="text-[15px] text-[#666]">User not found.</p>;
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
      <AdminBanBar userId={profile.id} username={profile.username} />

      <h2 className="mb-2 text-sm font-semibold text-[#666]">Submissions</h2>
      <PostList posts={posts ?? []} emptyMessage="No submissions yet." />
    </div>
  );
}
