import type { Metadata } from "next";
import StaticPageView from "@/components/StaticPageView";
import { defaultPage, type PageSlug } from "@/lib/page-content";
import { getPublishedPage } from "@/lib/pages";
import { pageMeta, summarize } from "@/lib/seo";

export function createEditablePage(slug: PageSlug) {
  async function generateMetadata(): Promise<Metadata> {
    const page = await getPublishedPage(slug);
    const fallback = defaultPage(slug);
    const description =
      page.subtitle.trim() ||
      summarize(page.body) ||
      summarize(fallback.body) ||
      fallback.title;

    return pageMeta({
      title: page.title,
      description,
      path: `/${slug}`,
    });
  }

  async function Page() {
    const page = await getPublishedPage(slug);
    return <StaticPageView page={page} showEditLink />;
  }

  return { generateMetadata, Page };
}
