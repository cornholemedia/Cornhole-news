import PostList from "@/components/PostList";
import { getTopPosts } from "@/lib/posts";

export const revalidate = 0;

export default async function HomePage() {
  const posts = await getTopPosts();

  return (
    <div>
      <PostList posts={posts} />
    </div>
  );
}
