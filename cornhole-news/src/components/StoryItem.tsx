import Link from "next/link";

export type Story = {
  id: number;
  title: string;
  url?: string;
  domain?: string;
  points: number;
  author: string;
  timeAgo: string;
  commentCount: number;
};

type StoryItemProps = {
  story: Story;
  rank: number;
};

export default function StoryItem({ story, rank }: StoryItemProps) {
  const domain = story.domain || (story.url ? new URL(story.url).hostname.replace("www.", "") : null);

  return (
    <div className="flex gap-2 py-1.5 text-[15px] leading-snug">
      <span className="w-6 shrink-0 text-right text-[#666]">{rank}.</span>

      <div className="min-w-0 flex-1">
        <div>
          {story.url ? (
            <a
              href={story.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-black hover:underline"
            >
              {story.title}
            </a>
          ) : (
            <Link href={`/item/${story.id}`} className="font-medium text-black hover:underline">
              {story.title}
            </Link>
          )}
          {domain && (
            <span className="ml-1 text-sm text-[#666]">({domain})</span>
          )}
        </div>

        <div className="mt-0.5 text-[13px] text-[#666]">
          {story.points} points by{" "}
          <Link href={`/user/${story.author}`} className="hover:underline">
            {story.author}
          </Link>{" "}
          {story.timeAgo}{" "}
          |{" "}
          <Link href={`/item/${story.id}`} className="hover:underline">
            {story.commentCount} {story.commentCount === 1 ? "comment" : "comments"}
          </Link>
        </div>
      </div>
    </div>
  );
}
