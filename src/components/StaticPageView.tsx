import EditPageLink from "@/components/EditPageLink";
import PageBody from "@/components/PageBody";
import { PAGE_PRESENTATION, type StaticPageContent } from "@/lib/page-content";

export default function StaticPageView({
  page,
  showEditLink = false,
}: {
  page: StaticPageContent;
  showEditLink?: boolean;
}) {
  const presentation = PAGE_PRESENTATION[page.slug];
  const body = (
    <PageBody body={page.body} headingClass={presentation.headingClass} />
  );

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">{page.title}</h1>
      {page.subtitle.trim() ? (
        <p className={presentation.subtitleClass}>{page.subtitle}</p>
      ) : null}
      {presentation.variant === "card" ? (
        <div className={presentation.cardClass}>{body}</div>
      ) : (
        body
      )}
      {showEditLink ? <EditPageLink slug={page.slug} /> : null}
    </div>
  );
}
