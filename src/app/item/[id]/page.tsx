import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostById } from "@/lib/posts";
import { formatTimeAgo } from "@/lib/time";
import Comments from "@/components/Comments";
import AdminPostControls from "@/components/AdminPostControls";
import { pageMeta, summarize } from "@/lib/seo";

export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const postId = Number(id);
  const post = Number.isInteger(postId) ? await getPostById(postId) : null;

  if (!post) {
    return pageMeta({
      title: "Story not found",
      description: "That story is not on Cornhole News.",
      path: `/item/${id}`,
      noIndex: true,
    });
  }

  const description = summarize(
    post.body?.trim() || `A story shared on Cornhole News: ${post.title}`
  );

  return pageMeta({
    title: post.title,
    description,
    path: `/item/${post.id}`,
    ogType: "article",
  });
}

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const postId = Number(id);
  const post = Number.isInteger(postId) ? await getPostById(postId) : null;

  if (!post) {
    notFound();
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
