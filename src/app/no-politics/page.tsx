import HomeFeed, { homeFeedMetadata } from "@/components/HomeFeed";

export const revalidate = 180;

export function generateMetadata() {
  return homeFeedMetadata(1, false);
}

export default function NoPoliticsPage() {
  return <HomeFeed page={1} showPolitics={false} />;
}
