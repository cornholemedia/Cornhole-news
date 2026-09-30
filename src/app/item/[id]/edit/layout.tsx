import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  return pageMeta({
    title: "Edit post",
    description: "Edit a story on Cornhole News.",
    path: `/item/${id}/edit`,
    noIndex: true,
  });
}

export default function EditPostLayout({ children }: { children: React.ReactNode }) {
  return children;
}
