import { notFound } from "next/navigation";
import { createEditablePage } from "@/lib/editable-route";
import { advertiseEnabled } from "@/lib/site";

const page = createEditablePage("advertise");

export const revalidate = 0;

export async function generateMetadata() {
  if (!advertiseEnabled()) notFound();
  return page.generateMetadata();
}

export default async function AdvertisePage() {
  if (!advertiseEnabled()) notFound();
  return page.Page();
}
