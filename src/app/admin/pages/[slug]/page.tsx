import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageEditor from "@/components/PageEditor";
import { isPageSlug } from "@/lib/page-content";
import { getPageForEdit } from "@/lib/pages";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const title = isPageSlug(slug) ? `Edit ${slug}` : "Edit page";

  return pageMeta({
    title,
    description: "Edit a Cornhole News page.",
    path: isPageSlug(slug) ? `/admin/pages/${slug}` : "/admin",
    noIndex: true,
  });
}

export default async function AdminEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isPageSlug(slug)) notFound();

  const page = await getPageForEdit(slug);
  return <PageEditor page={page} />;
}
