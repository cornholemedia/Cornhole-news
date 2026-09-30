import PostList from "@/components/PostList";
import { getNewPosts } from "@/lib/posts";
import { pageMeta } from "@/lib/seo";

export const revalidate = 0;

export const metadata = pageMeta({
  title: "New",
  description: "The latest cornhole stories and links, newest first.",
  path: "/new",
});

export default async function NewPage() {
  const posts = await getNewPosts();

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">New</h1>
      <PostList posts={posts} />
    </div>
  );
}
