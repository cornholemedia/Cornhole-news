import StaticPageView from "@/components/StaticPageView";
import { getPublishedPage } from "@/lib/pages";

export const revalidate = 0;

export default async function AboutPage() {
  const page = await getPublishedPage("about");
  return <StaticPageView page={page} showEditLink />;
}
