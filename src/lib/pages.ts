import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_PAGES,
  PAGE_SLUGS,
  type EditablePage,
  type PageSlug,
  type StaticPageContent,
  defaultPage,
} from "@/lib/page-content";

type PageRow = {
  slug: string;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  updated_at: string | null;
};

function publishedFromRow(slug: PageSlug, row: PageRow | null): StaticPageContent {
  const fallback = DEFAULT_PAGES[slug];
  if (!row) return defaultPage(slug);

  return {
    slug,
    title: row.title?.trim() || fallback.title,
    subtitle: row.subtitle ?? fallback.subtitle,
    body: row.body?.trim() ? row.body : fallback.body,
  };
}

async function fetchPageRows(): Promise<{ rows: PageRow[]; loadError: string | null }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("pages")
      .select("slug, title, subtitle, body, updated_at")
      .in("slug", [...PAGE_SLUGS]);

    if (error) {
      console.error("Error fetching pages:", error.message);
      return { rows: [], loadError: error.message };
    }

    return { rows: (data ?? []) as PageRow[], loadError: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load pages.";
    console.error("Error fetching pages:", message);
    return { rows: [], loadError: message };
  }
}

export async function getPublishedPage(slug: PageSlug): Promise<StaticPageContent> {
  const { rows, loadError } = await fetchPageRows();
  if (loadError) return defaultPage(slug);
  const row = rows.find((entry) => entry.slug === slug) ?? null;
  return publishedFromRow(slug, row);
}

export async function getPagesForAdmin(): Promise<EditablePage[]> {
  const { rows, loadError } = await fetchPageRows();

  return PAGE_SLUGS.map((slug) => {
    const row = rows.find((entry) => entry.slug === slug) ?? null;
    const fallback = defaultPage(slug);

    if (!row) {
      return {
        ...fallback,
        stored: false,
        updatedAt: null,
        loadError,
      };
    }

    return {
      slug,
      title: row.title ?? fallback.title,
      subtitle: row.subtitle ?? "",
      body: row.body ?? "",
      stored: true,
      updatedAt: row.updated_at,
      loadError,
    };
  });
}

export async function getPageForEdit(slug: PageSlug): Promise<EditablePage> {
  const pages = await getPagesForAdmin();
  const page = pages.find((entry) => entry.slug === slug);
  return page ?? { ...defaultPage(slug), stored: false, updatedAt: null, loadError: null };
}
