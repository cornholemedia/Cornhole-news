import PostList from "@/components/PostList";
import { getTopPosts } from "@/lib/posts";
import { pageMeta } from "@/lib/seo";

export const revalidate = 0;

export const metadata = pageMeta({
  title: "Cornhole News",
  description: "Top stories and links, ranked by votes from the community.",
  path: "/",
  absoluteTitle: true,
});

export default async function HomePage() {
  const posts = await getTopPosts();

  return (
    <div>
      <PostList posts={posts} />
    </div>
  );
}
