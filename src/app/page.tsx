import PostList from "@/components/PostList";
import ShowPoliticsToggle from "@/components/ShowPoliticsToggle";
import { getTopPosts } from "@/lib/posts";
import { resolveShowPolitics } from "@/lib/show-politics-server";
import { pageMeta } from "@/lib/seo";

export const revalidate = 0;

export const metadata = pageMeta({
  title: "Cornhole News",
  description: "Top stories and links, ranked by votes from the community.",
  path: "/",
  absoluteTitle: true,
});

export default async function HomePage() {
  const showPolitics = await resolveShowPolitics();
  const posts = await getTopPosts(30, { showPolitics });

  return (
    <div>
      <ShowPoliticsToggle showPolitics={showPolitics} />
      <PostList
        posts={posts}
        emptyMessage={
          showPolitics
            ? "No posts yet. Be the first to submit one!"
            : "No stories to show while politics is hidden."
        }
      />
    </div>
  );
}
