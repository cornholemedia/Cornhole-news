import PostList from "@/components/PostList";
import { getNewPosts } from "@/lib/posts";

export const revalidate = 0;

export default async function NewPage() {
  const posts = await getNewPosts();

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">New</h1>
      <PostList posts={posts} />
    </div>
  );
}
