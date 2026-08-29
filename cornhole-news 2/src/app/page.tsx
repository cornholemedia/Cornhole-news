import StoryList from "@/components/StoryList";
import { topStories } from "@/lib/mock-data";

export default function HomePage() {
  return (
    <div>
      <StoryList stories={topStories} />
    </div>
  );
}
