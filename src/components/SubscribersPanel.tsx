import Link from "next/link";
import SubscriberRemoveButton from "@/components/SubscriberRemoveButton";
import type { NewsletterAdminList, NewsletterSubscriber } from "@/lib/newsletter";

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function statusLabel(status: string): string {
  if (status === "active") return "Active";
  if (status === "unsubscribed") return "Unsubscribed";
  return status;
}

function exportHref(search: string): string {
  if (!search) return "/admin/newsletter/export";
  return `/admin/newsletter/export?q=${encodeURIComponent(search)}`;
}

function countText(list: NewsletterAdminList): string {
  if (list.total === null || list.matched === null) return "";
  const addresses = `${list.total} ${list.total === 1 ? "address" : "addresses"}`;
  if (!list.search) return `${addresses}.`;
  const matches = `${list.matched} ${list.matched === 1 ? "match" : "matches"}`;
  return `${matches} of ${addresses}.`;
}

export default function SubscribersPanel({ list }: { list: NewsletterAdminList }) {
  const shown = list.subscribers.length;
  const matched = list.matched ?? 0;
  const hasMore = list.matched !== null && matched > shown;
  const summary = countText(list);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold">Subscribers</h1>
      <p className="mb-3 text-[15px] leading-relaxed text-[#666]">
        Email addresses from the footer signup. Newest first. Remove deletes that
        address. Someone who used an unsubscribe link stays here as Unsubscribed.
      </p>
      <p className="mb-6 text-sm">
        <Link href="/admin" className="text-[#3f679b] hover:underline">
          Back to admin
        </Link>
      </p>

      <section
        className="rounded border border-[#e0e0e0] bg-white p-4"
        aria-labelledby="subscribers-heading"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="subscribers-heading" className="font-semibold">
              Newsletter
            </h2>
            {summary ? <p className="mt-1 text-sm text-[#3a3a3a]">{summary}</p> : null}
          </div>
          {!list.loadError ? (
            <a
              href={exportHref(list.search)}
              className="nav-button field-button inline-flex min-h-11 items-center justify-center rounded bg-[#3f679b] px-4 text-[15px] font-medium text-white hover:bg-[#345580] hover:no-underline"
            >
              Download CSV
            </a>
          ) : null}
        </div>

        <form
          method="get"
          action="/admin/subscribers"
          className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end"
        >
          <div className="min-w-0 flex-1">
            <label htmlFor="subscriber-search" className="field-label">
              Search
            </label>
            <input
              id="subscriber-search"
              name="q"
              type="search"
              defaultValue={list.search}
              maxLength={200}
              placeholder="Email or page"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="field-input min-h-11"
            />
          </div>
          <button
            type="submit"
            className="field-button min-h-11 rounded bg-[#3f679b] px-4 text-[15px] font-medium text-white hover:bg-[#345580]"
          >
            Search
          </button>
          {list.search ? (
            <Link
              href="/admin/subscribers"
              className="inline-flex min-h-11 items-center text-sm text-[#3f679b] hover:underline"
            >
              Clear
            </Link>
          ) : null}
        </form>

        {list.loadError ? (
          <p role="alert" className="mt-4 rounded border border-[#e0e0e0] bg-[#f6f6ef] p-3 text-sm text-red-700">
            {list.loadError}
          </p>
        ) : shown === 0 ? (
          <p className="mt-4 text-sm text-[#3a3a3a]">
            {list.search ? "No subscribers match that search." : "No subscribers yet."}
          </p>
        ) : (
          <SubscriberTable
            subscribers={list.subscribers}
            hasMore={hasMore}
            search={list.search}
            shown={shown}
          />
        )}
      </section>
    </div>
  );
}

function SubscriberTable({
  subscribers,
  hasMore,
  search,
  shown,
}: {
  subscribers: NewsletterSubscriber[];
  hasMore: boolean;
  search: string;
  shown: number;
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <caption className="sr-only">Newsletter subscribers</caption>
        <thead>
          <tr className="border-b border-[#e0e0e0] text-[#3a3a3a]">
            <th scope="col" className="py-2 pr-3 font-medium">
              Email
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Signed up
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Page
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Status
            </th>
            <th scope="col" className="py-2 font-medium">
              <span className="sr-only">Remove</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {subscribers.map((subscriber) => (
            <tr key={subscriber.id} className="border-b border-[#e0e0e0] last:border-b-0">
              <td className="py-2 pr-3">
                <a
                  href={`mailto:${encodeURIComponent(subscriber.email)}`}
                  className="text-[#3f679b] hover:underline"
                >
                  {subscriber.email}
                </a>
              </td>
              <td className="whitespace-nowrap py-2 pr-3 text-[#1a1a1a]">
                <time dateTime={subscriber.createdAt}>{formatWhen(subscriber.createdAt)}</time>
              </td>
              <td className="py-2 pr-3 text-[#1a1a1a]">{subscriber.source || "—"}</td>
              <td className="py-2 pr-3 text-[#1a1a1a]">{statusLabel(subscriber.status)}</td>
              <td className="py-2 text-right">
                <SubscriberRemoveButton id={subscriber.id} email={subscriber.email} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {hasMore ? (
        <p className="mt-3 text-sm text-[#3a3a3a]">
          Showing the latest {shown}. Download CSV includes {search ? "every match" : "every subscriber"}.
        </p>
      ) : null}
    </div>
  );
}
