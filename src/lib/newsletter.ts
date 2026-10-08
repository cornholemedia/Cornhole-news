import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const MIGRATION_HINT =
  "The newsletter table is not in the database yet. In Supabase, open the SQL editor and run supabase/migrations/20261008_newsletter_subscribers.sql.";

export type NewsletterSubscriber = {
  id: string;
  email: string;
  source: string;
  status: string;
  createdAt: string;
};

export type NewsletterAdminList = {
  subscribers: NewsletterSubscriber[];
  total: number | null;
  loadError: string | null;
};

type SubscriberRow = {
  id: string;
  email: string;
  source: string | null;
  status: string | null;
  created_at: string;
};

function missingTable(message: string): boolean {
  return /newsletter_subscribers|schema cache|does not exist/i.test(message);
}

function toSubscriber(row: SubscriberRow): NewsletterSubscriber {
  return {
    id: row.id,
    email: row.email,
    source: row.source ?? "",
    status: row.status ?? "active",
    createdAt: row.created_at,
  };
}

export function csvCell(value: string): string {
  let safe = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (/^[=+\-@\t]/.test(safe)) safe = `'${safe}`;
  if (/[",\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

export function subscribersToCsv(rows: NewsletterSubscriber[]): string {
  const lines = ["email,created_at,source,status"];
  for (const row of rows) {
    lines.push([row.email, row.createdAt, row.source, row.status].map(csvCell).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

async function fetchSubscriberPage(
  from: number,
  to: number
): Promise<{ rows: NewsletterSubscriber[]; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("newsletter_subscribers")
    .select("id, email, source, status, created_at")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) return { rows: [], error: error.message };
  return { rows: ((data ?? []) as SubscriberRow[]).map(toSubscriber), error: null };
}

export async function getNewsletterSubscribersForAdmin(): Promise<NewsletterAdminList> {
  const empty: NewsletterAdminList = { subscribers: [], total: 0, loadError: null };
  if (!isSupabaseConfigured()) {
    return {
      ...empty,
      total: null,
      loadError: "Supabase is not configured, so subscribers cannot be loaded.",
    };
  }

  try {
    const supabase = await createClient();
    const [listResult, countResult] = await Promise.all([
      supabase
        .from("newsletter_subscribers")
        .select("id, email, source, status, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true }),
    ]);

    const error = listResult.error ?? countResult.error;
    if (error) {
      console.error("Error fetching newsletter subscribers:", error.message);
      return {
        subscribers: [],
        total: null,
        loadError: missingTable(error.message) ? MIGRATION_HINT : error.message,
      };
    }

    return {
      subscribers: ((listResult.data ?? []) as SubscriberRow[]).map(toSubscriber),
      total: countResult.count ?? listResult.data?.length ?? 0,
      loadError: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load subscribers.";
    console.error("Error fetching newsletter subscribers:", message);
    return {
      subscribers: [],
      total: null,
      loadError: missingTable(message) ? MIGRATION_HINT : message,
    };
  }
}

export async function getAllNewsletterSubscribers(): Promise<
  { rows: NewsletterSubscriber[]; error: string | null }
> {
  if (!isSupabaseConfigured()) {
    return { rows: [], error: "Supabase is not configured." };
  }

  const pageSize = 1000;
  const rows: NewsletterSubscriber[] = [];
  let from = 0;

  while (true) {
    const page = await fetchSubscriberPage(from, from + pageSize - 1);
    if (page.error) {
      return { rows: [], error: missingTable(page.error) ? MIGRATION_HINT : page.error };
    }
    rows.push(...page.rows);
    if (page.rows.length < pageSize) break;
    from += pageSize;
  }

  return { rows, error: null };
}
