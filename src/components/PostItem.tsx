import Link from "next/link";
import type { PostWithStats } from "@/lib/posts";
import { formatTimeAgo } from "@/lib/time";
import VoteButton from "./VoteButton";

type PostItemProps = {
  post: PostWithStats;
  rank: number;
};

export default function PostItem({ post, rank }: PostItemProps) {
  const domain = post.url ? new URL(post.url).hostname.replace("www.", "") : null;

  return (
    <div className="flex gap-2 py-1.5 text-[15px] leading-snug">
      <span className="w-6 shrink-0 text-right text-[#666]">{rank}.</span>
      <VoteButton postId={post.id} />

      <div className="min-w-0 flex-1">
        <div>
          {post.url ? (
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-black hover:underline"
            >
              {post.title}
            </a>
          ) : (
            <Link href={`/item/${post.id}`} className="font-medium text-black hover:underline">
              {post.title}
            </Link>
          )}
          {domain && <span className="ml-1 text-sm text-[#666]">({domain})</span>}
        </div>

        <div className="mt-0.5 text-[13px] text-[#666]">
          {post.points} {post.points === 1 ? "point" : "points"} by{" "}
          <Link href={`/user/${post.author_username}`} className="hover:underline">
            {post.author_username}
          </Link>{" "}
          {formatTimeAgo(post.created_at)} |{" "}
          <Link href={`/item/${post.id}`} className="hover:underline">
            {post.comment_count} {post.comment_count === 1 ? "comment" : "comments"}
          </Link>
        </div>
      </div>
    </div>
  );
}
