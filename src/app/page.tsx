import Link from "next/link";
import type { Metadata } from "next";
import MobileAd from "@/components/MobileAd";
import PostList from "@/components/PostList";
import ShowPoliticsToggle from "@/components/ShowPoliticsToggle";
import { PAGE_SIZE, getTopPosts } from "@/lib/posts";
import { resolveShowPolitics } from "@/lib/show-politics-server";
import { pageMeta } from "@/lib/seo";

export const revalidate = 0;

const HOME_DESCRIPTION = "Top stories and links, ranked by votes from the community.";

/** 1-based homepage page. Missing or invalid values are page 1. */
function homePage(value: string | undefined): number {
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  if (!Number.isSafeInteger(page)) return 1;
  const offset = (page - 1) * PAGE_SIZE;
  if (!Number.isSafeInteger(offset)) return 1;
  return page;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}): Promise<Metadata> {
  const { p } = await searchParams;
  const page = homePage(p);

  return pageMeta({
    title: "Cornhole News",
    description: HOME_DESCRIPTION,
    path: page > 1 ? `/?p=${page}` : "/",
    absoluteTitle: true,
    noIndex: page > 1,
  });
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const { p } = await searchParams;
  const page = homePage(p);
  const offset = (page - 1) * PAGE_SIZE;
  const showPolitics = await resolveShowPolitics();
  const rows = await getTopPosts(PAGE_SIZE + 1, { showPolitics, offset });
  const posts = rows.slice(0, PAGE_SIZE);
  const hasMore = rows.length > PAGE_SIZE;

  return (
    <div>
      <MobileAd />
      <ShowPoliticsToggle showPolitics={showPolitics} />
      <PostList
        posts={posts}
        startRank={offset + 1}
        emptyMessage={
          page > 1
            ? "No more stories."
            : showPolitics
              ? "No posts yet. Be the first to submit one!"
              : "No stories to show while politics is hidden."
        }
      />
      {hasMore ? (
        <p className="mt-4 text-[15px]">
          <Link href={`/?p=${page + 1}`} className="text-[#3f679b] hover:underline">
            More
          </Link>
        </p>
      ) : null}
    </div>
  );
}
