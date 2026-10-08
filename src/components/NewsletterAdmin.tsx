import Link from "next/link";
import type { NewsletterAdminList } from "@/lib/newsletter";

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

export default function NewsletterAdmin({ list }: { list: NewsletterAdminList }) {
  const total = list.total;
  const shown = list.subscribers.length;
  const hasMore = total !== null && total > shown;

  return (
    <section className="rounded border border-[#e0e0e0] bg-white p-4" aria-labelledby="newsletter-admin-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="newsletter-admin-heading" className="font-semibold">
            Newsletter
          </h2>
          <p className="mt-1 text-sm text-[#3a3a3a]">
            People who subscribed from the footer.
            {total !== null ? ` ${total} ${total === 1 ? "address" : "addresses"}.` : ""}
          </p>
        </div>
        {!list.loadError ? (
          <Link
            href="/admin/newsletter/export"
            className="field-button inline-flex min-h-11 items-center justify-center rounded bg-[#3f679b] px-4 text-[15px] font-medium text-white hover:bg-[#345580]"
          >
            Export CSV
          </Link>
        ) : null}
      </div>

      {list.loadError ? (
        <p className="mt-4 rounded border border-[#e0e0e0] bg-[#f6f6ef] p-3 text-sm text-red-700">
          {list.loadError}
        </p>
      ) : shown === 0 ? (
        <p className="mt-4 text-sm text-[#3a3a3a]">No subscribers yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <caption className="sr-only">Newsletter subscribers</caption>
            <thead>
              <tr className="border-b border-[#e0e0e0] text-[#3a3a3a]">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Email
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Date
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Source
                </th>
                <th scope="col" className="py-2 font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {list.subscribers.map((subscriber) => (
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
                    {formatWhen(subscriber.createdAt)}
                  </td>
                  <td className="py-2 pr-3 text-[#1a1a1a]">{subscriber.source || "—"}</td>
                  <td className="py-2 text-[#1a1a1a]">{statusLabel(subscriber.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasMore ? (
            <p className="mt-3 text-sm text-[#3a3a3a]">
              Showing the latest {shown}. The CSV includes every subscriber.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
