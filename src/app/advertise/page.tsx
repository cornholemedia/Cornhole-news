import StaticPageView from "@/components/StaticPageView";
import { getPublishedPage } from "@/lib/pages";

export const revalidate = 0;

export default async function AdvertisePage() {
  const page = await getPublishedPage("advertise");
  return <StaticPageView page={page} showEditLink />;
}
