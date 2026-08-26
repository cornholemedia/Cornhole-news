import StoryList from "@/components/StoryList";
import { newStories } from "@/lib/mock-data";

export default function NewPage() {
  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">New</h1>
      <StoryList stories={newStories} />
    </div>
  );
}
