import Link from "next/link";
import type { Metadata } from "next";
import CleanPassedQuery from "@/components/CleanPassedQuery";
import MobileAd from "@/components/MobileAd";
import PostList from "@/components/PostList";
import ShowPoliticsToggle from "@/components/ShowPoliticsToggle";
import { homeHref } from "@/lib/home-path";
import { PAGE_SIZE, getTopPosts } from "@/lib/posts";
import { pageMeta } from "@/lib/seo";

const HOME_DESCRIPTION = "Top stories and links, ranked by votes from the community.";

export function homeFeedMetadata(page: number, showPolitics: boolean): Metadata {
  return pageMeta({
    title: "Cornhole News",
    description: HOME_DESCRIPTION,
    path: homeHref(page, showPolitics),
    absoluteTitle: page === 1 && showPolitics,
    noIndex: page > 1 || !showPolitics,
  });
}

export default async function HomeFeed({
  page,
  showPolitics,
}: {
  page: number;
  showPolitics: boolean;
}) {
  const offset = (page - 1) * PAGE_SIZE;
  const rows = await getTopPosts(PAGE_SIZE + 1, { showPolitics, offset });
  const posts = rows.slice(0, PAGE_SIZE);
  const hasMore = rows.length > PAGE_SIZE;

  return (
    <div>
      <CleanPassedQuery />
      <MobileAd />
      <ShowPoliticsToggle showPolitics={showPolitics} page={page} />
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
          <Link href={homeHref(page + 1, showPolitics)} className="text-[#3f679b] hover:underline">
            More
          </Link>
        </p>
      ) : null}
    </div>
  );
}
