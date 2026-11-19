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
  matched: number | null;
  search: string;
  loadError: string | null;
};

export type NewsletterSubscriberTotal = {
  total: number | null;
  loadError: string | null;
};

const LIST_LIMIT = 200;
const PAGE_SIZE = 1000;

type SubscriberRow = {
  id: string;
  email: string;
  source: string | null;
  status: string | null;
  created_at: string;
};

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export function normalizeSubscriberSearch(value: string | null | undefined): string {
  return (value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200);
}

// Quote the pattern so commas, dots, and spaces in an email or path stay one
// PostgREST token. Backslash escapes LIKE wildcards and a quote inside that token.
export function subscriberSearchFilter(search: string): string | null {
  const clean = normalizeSubscriberSearch(search);
  if (!clean) return null;
  const pattern = `%${clean.replace(/[\\%_"]/g, (char) => `\\${char}`)}%`;
  const quoted = `"${pattern}"`;
  return `email.ilike.${quoted},source.ilike.${quoted}`;
}

function listQuery(supabase: ServerClient, search: string) {
  let query = supabase
    .from("newsletter_subscribers")
    .select("id, email, source, status, created_at")
    .order("created_at", { ascending: false });
  const filter = subscriberSearchFilter(search);
  if (filter) query = query.or(filter);
  return query;
}

function countQuery(supabase: ServerClient, search: string) {
  let query = supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true });
  const filter = subscriberSearchFilter(search);
  if (filter) query = query.or(filter);
  return query;
}

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

function loadErrorMessage(message: string): string {
  return missingTable(message) ? MIGRATION_HINT : message;
}

export async function getNewsletterSubscriberTotal(): Promise<NewsletterSubscriberTotal> {
  if (!isSupabaseConfigured()) {
    return {
      total: null,
      loadError: "Supabase is not configured, so subscribers cannot be loaded.",
    };
  }

  try {
    const supabase = await createClient();
    const { count, error } = await countQuery(supabase, "");
    if (error) {
      console.error("Error counting newsletter subscribers:", error.message);
      return { total: null, loadError: loadErrorMessage(error.message) };
    }
    return { total: count ?? 0, loadError: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load subscribers.";
    console.error("Error counting newsletter subscribers:", message);
    return { total: null, loadError: loadErrorMessage(message) };
  }
}

export async function getNewsletterSubscribersForAdmin(search = ""): Promise<NewsletterAdminList> {
  const clean = normalizeSubscriberSearch(search);
  const empty: NewsletterAdminList = {
    subscribers: [],
    total: null,
    matched: null,
    search: clean,
    loadError: null,
  };
  if (!isSupabaseConfigured()) {
    return {
      ...empty,
      loadError: "Supabase is not configured, so subscribers cannot be loaded.",
    };
  }

  try {
    const supabase = await createClient();
    const [listResult, totalResult, matchedResult] = await Promise.all([
      listQuery(supabase, clean).limit(LIST_LIMIT),
      countQuery(supabase, ""),
      clean ? countQuery(supabase, clean) : Promise.resolve(null),
    ]);

    const error = listResult.error ?? totalResult.error ?? matchedResult?.error;
    if (error) {
      console.error("Error fetching newsletter subscribers:", error.message);
      return { ...empty, loadError: loadErrorMessage(error.message) };
    }

    const total = totalResult.count ?? 0;
    return {
      subscribers: ((listResult.data ?? []) as SubscriberRow[]).map(toSubscriber),
      total,
      matched: matchedResult ? (matchedResult.count ?? 0) : total,
      search: clean,
      loadError: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load subscribers.";
    console.error("Error fetching newsletter subscribers:", message);
    return { ...empty, loadError: loadErrorMessage(message) };
  }
}

export async function getAllNewsletterSubscribers(
  search = ""
): Promise<{ rows: NewsletterSubscriber[]; error: string | null }> {
  const clean = normalizeSubscriberSearch(search);
  if (!isSupabaseConfigured()) {
    return { rows: [], error: "Supabase is not configured." };
  }

  const rows: NewsletterSubscriber[] = [];
  let from = 0;

  while (true) {
    const supabase = await createClient();
    const { data, error } = await listQuery(supabase, clean).range(from, from + PAGE_SIZE - 1);
    if (error) {
      return { rows: [], error: loadErrorMessage(error.message) };
    }
    const page = ((data ?? []) as SubscriberRow[]).map(toSubscriber);
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return { rows, error: null };
}
