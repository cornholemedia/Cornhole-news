import type { Metadata } from "next";
import SubscribersPanel from "@/components/SubscribersPanel";
import { getNewsletterSubscribersForAdmin, normalizeSubscriberSearch } from "@/lib/newsletter";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Subscribers",
  description: "Newsletter addresses collected from the Cornhole News footer.",
  path: "/admin/subscribers",
  noIndex: true,
});

export default async function AdminSubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const list = await getNewsletterSubscribersForAdmin(normalizeSubscriberSearch(q));
  return <SubscribersPanel list={list} />;
}
