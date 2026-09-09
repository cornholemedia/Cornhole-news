import Link from "next/link";
import { getPostById } from "@/lib/posts";
import { formatTimeAgo } from "@/lib/time";
import Comments from "@/components/Comments";
import AdminPostControls from "@/components/AdminPostControls";

export const revalidate = 0;

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getPostById(Number(id));

  if (!post) {
    return (
      <div>
        <p className="text-[15px] text-[#666]">Story not found.</p>
        <Link href="/" className="text-sm text-[#3f679b] hover:underline">
          &larr; Back to Top
        </Link>
      </div>
    );
  }

  const domain = post.url ? new URL(post.url).hostname.replace("www.", "") : null;

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-medium text-black">
          {post.url ? (
            <a href={post.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {post.title}
            </a>
          ) : (
            post.title
          )}
          {domain && <span className="ml-1 text-sm text-[#666]">({domain})</span>}
        </div>

        <div className="mt-1 text-[13px] text-[#666]">
          {post.points} {post.points === 1 ? "point" : "points"} by{" "}
          <Link href={`/user/${post.author_username}`} className="hover:underline">
            {post.author_username}
          </Link>{" "}
          {formatTimeAgo(post.created_at)}
        </div>

        {post.body && (
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-black">
            {post.body}
          </p>
        )}

        <AdminPostControls postId={post.id} authorId={post.author_id} />
      </div>

      <Comments postId={post.id} />
    </div>
  );
}
