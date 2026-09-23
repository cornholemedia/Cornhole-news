import { notFound } from "next/navigation";
import PageEditor from "@/components/PageEditor";
import { isPageSlug } from "@/lib/page-content";
import { getPageForEdit } from "@/lib/pages";

export const dynamic = "force-dynamic";

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
