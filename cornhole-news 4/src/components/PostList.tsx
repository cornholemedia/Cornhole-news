import PostItem from "./PostItem";
import type { PostWithStats } from "@/lib/posts";

type PostListProps = {
  posts: PostWithStats[];
  startRank?: number;
  emptyMessage?: string;
};

export default function PostList({
  posts,
  startRank = 1,
  emptyMessage = "No posts yet. Be the first to submit one!",
}: PostListProps) {
  if (posts.length === 0) {
    return <p className="py-6 text-[15px] text-[#666]">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-0.5">
      {posts.map((post, index) => (
        <PostItem key={post.id} post={post} rank={startRank + index} />
      ))}
    </div>
  );
}
