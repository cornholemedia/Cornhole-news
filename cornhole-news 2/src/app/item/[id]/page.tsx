import Link from "next/link";
import { topStories, newStories } from "@/lib/mock-data";

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const storyId = Number(id);
  const story = [...topStories, ...newStories].find((s) => s.id === storyId);

  if (!story) {
    return (
      <div>
        <p className="text-[15px] text-[#666]">Story not found.</p>
        <Link href="/" className="text-sm text-[#3f679b] hover:underline">
          &larr; Back to Top
        </Link>
      </div>
    );
  }

  const domain =
    story.domain || (story.url ? new URL(story.url).hostname.replace("www.", "") : null);

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-medium text-black">
          {story.url ? (
            <a
              href={story.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {story.title}
            </a>
          ) : (
            story.title
          )}
          {domain && <span className="ml-1 text-sm text-[#666]">({domain})</span>}
        </div>

        <div className="mt-1 text-[13px] text-[#666]">
          {story.points} points by{" "}
          <Link href={`/user/${story.author}`} className="hover:underline">
            {story.author}
          </Link>{" "}
          {story.timeAgo} | {story.commentCount}{" "}
          {story.commentCount === 1 ? "comment" : "comments"}
        </div>
      </div>

      <div className="rounded border border-[#e0e0e0] bg-white p-4 text-sm text-[#666]">
        Comments aren&apos;t hooked up yet — this is still a frontend framework
        running on mock data. Once Supabase is connected, discussion will show
        up here.
      </div>
    </div>
  );
}
