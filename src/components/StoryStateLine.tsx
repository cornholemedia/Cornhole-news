import { storyStateLabel } from "@/lib/story-state";

/** Full state name under a story title. No state, and nothing is shown. */
export default function StoryStateLine({ code }: { code: string | null | undefined }) {
  const label = storyStateLabel(code);
  if (!label) return null;

  return <div className="mt-0.5 text-[13px] font-bold leading-snug">{label}</div>;
}
