import { notFound, redirect } from "next/navigation";
import HomeFeed, { homeFeedMetadata } from "@/components/HomeFeed";
import { parseHomePageParam } from "@/lib/home-path";

export const revalidate = 180;

export function generateStaticParams() {
  return [];
}

function pageNumber(value: string): number {
  const page = parseHomePageParam(value);
  if (page == null) notFound();
  if (page === 1) redirect("/");
  return page;
}

export async function generateMetadata({ params }: { params: Promise<{ page: string }> }) {
  const { page: raw } = await params;
  return homeFeedMetadata(pageNumber(raw), true);
}

export default async function HomePageNumber({ params }: { params: Promise<{ page: string }> }) {
  const { page: raw } = await params;
  return <HomeFeed page={pageNumber(raw)} showPolitics />;
}
