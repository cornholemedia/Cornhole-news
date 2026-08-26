import StoryItem, { type Story } from "./StoryItem";

type StoryListProps = {
  stories: Story[];
  startRank?: number;
};

export default function StoryList({ stories, startRank = 1 }: StoryListProps) {
  return (
    <div className="space-y-0.5">
      {stories.map((story, index) => (
        <StoryItem
          key={story.id}
          story={story}
          rank={startRank + index}
        />
      ))}
    </div>
  );
}
