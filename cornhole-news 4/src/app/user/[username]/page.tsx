import { createClient } from "@/lib/supabase/server";
import PostList from "@/components/PostList";

export const revalidate = 0;

export default async function UserPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, created_at")
    .eq("username", username)
    .single();

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
      <p className="mb-6 text-sm text-[#666]">
        joined {new Date(profile.created_at).toLocaleDateString()}
      </p>

      <h2 className="mb-2 text-sm font-semibold text-[#666]">Submissions</h2>
      <PostList posts={posts ?? []} emptyMessage="No submissions yet." />
    </div>
  );
}
