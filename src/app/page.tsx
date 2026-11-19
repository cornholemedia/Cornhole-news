import HomeFeed, { homeFeedMetadata } from "@/components/HomeFeed";

export const revalidate = 180;

export function generateMetadata() {
  return homeFeedMetadata(1, true);
}

export default function HomePage() {
  return <HomeFeed page={1} showPolitics />;
}
