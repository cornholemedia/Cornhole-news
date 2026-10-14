import "server-only";
import {
  DIGEST_BOT_USERNAME,
  DIGEST_MIGRATION_HINT,
  DIGEST_SECTIONS,
  digestPostBody,
  formatDigestDate,
  isDigestSection,
  missingDigestSchema,
  parseDigestDate,
} from "@/lib/digest";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type DigestAdminSummary = {
  pendingCount: number;
  loadError: string | null;
};

export type DigestReviewStory = {
  id: string;
  headline: string;
  url: string;
  body: string;
};

export type DigestReviewGroup = {
  section: string;
  stories: DigestReviewStory[];
};

export type DigestDateChoice = {
  date: string;
  label: string;
  pendingCount: number;
};

export type DigestReview = {
  dates: DigestDateChoice[];
  selectedDate: string | null;
  selectedLabel: string | null;
  groups: DigestReviewGroup[];
  pendingCount: number;
  moreWaiting: number;
  botReady: boolean;
  botIsAdmin: boolean;
  loadError: string | null;
};

type DateRow = {
  digest_date: string;
  pending_count: number | string;
  story_count: number | string;
};

type StoryRow = {
  id: string;
  section: string;
  headline: string;
  url: string;
  paper: string;
  state: string;
  synopsis: string;
};

const emptyReview: DigestReview = {
  dates: [],
  selectedDate: null,
  selectedLabel: null,
  groups: [],
  pendingCount: 0,
  moreWaiting: 0,
  botReady: false,
  botIsAdmin: false,
  loadError: null,
};

function choice(date: string, pendingCount: number): DigestDateChoice {
  return { date, label: formatDigestDate(date), pendingCount };
}

export async function getDigestAdminSummary(): Promise<DigestAdminSummary> {
  if (!isSupabaseConfigured()) {
    return {
      pendingCount: 0,
      loadError: "Supabase is not configured, so digest stories cannot be loaded.",
    };
  }

  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("digest_stories")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    if (error) {
      console.error("Error counting digest stories:", error.message);
      return {
        pendingCount: 0,
        loadError: missingDigestSchema(error.message) ? DIGEST_MIGRATION_HINT : error.message,
      };
    }

    return { pendingCount: count ?? 0, loadError: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load digest stories.";
    console.error("Error counting digest stories:", message);
    return {
      pendingCount: 0,
      loadError: missingDigestSchema(message) ? DIGEST_MIGRATION_HINT : message,
    };
  }
}

export async function getDigestReview(requestedRaw: string | undefined): Promise<DigestReview> {
  if (!isSupabaseConfigured()) {
    return {
      ...emptyReview,
      loadError: "Supabase is not configured, so digest stories cannot be loaded.",
    };
  }

  const requested = parseDigestDate(requestedRaw);

  try {
    const supabase = await createClient();
    const [datesResult, botResult] = await Promise.all([
      supabase.rpc("admin_digest_dates"),
      supabase
        .from("profiles")
        .select("id, is_admin")
        .eq("username", DIGEST_BOT_USERNAME)
        .maybeSingle(),
    ]);

    if (datesResult.error) {
      console.error("Error loading digest dates:", datesResult.error.message);
      return {
        ...emptyReview,
        loadError: missingDigestSchema(datesResult.error.message)
          ? DIGEST_MIGRATION_HINT
          : datesResult.error.message,
      };
    }

    if (botResult.error) {
      console.error("Error loading the digest author:", botResult.error.message);
    }

    const dates = ((datesResult.data ?? []) as DateRow[]).map((row) =>
      choice(String(row.digest_date).slice(0, 10), Number(row.pending_count) || 0)
    );

    if (requested && !dates.some((row) => row.date === requested)) {
      dates.push(choice(requested, 0));
      dates.sort((a, b) => b.date.localeCompare(a.date));
    }

    const selectedDate =
      (requested && dates.some((row) => row.date === requested) ? requested : null) ??
      dates.find((row) => row.pendingCount > 0)?.date ??
      dates[0]?.date ??
      null;

    const bot = botResult.error
      ? null
      : (botResult.data as { id: string; is_admin: boolean } | null);
    const review: DigestReview = {
      dates,
      selectedDate,
      selectedLabel: selectedDate ? formatDigestDate(selectedDate) : null,
      groups: [],
      pendingCount: 0,
      moreWaiting: 0,
      // A failed profile lookup should not pretend the author is missing.
      botReady: Boolean(botResult.error) || Boolean(bot?.id),
      botIsAdmin: Boolean(bot?.is_admin),
      loadError: null,
    };

    if (!selectedDate) return review;

    const { data, error } = await supabase
      .from("digest_stories")
      .select("id, section, headline, url, paper, state, synopsis")
      .eq("digest_date", selectedDate)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(500);

    if (error) {
      console.error("Error loading digest stories:", error.message);
      return {
        ...review,
        loadError: missingDigestSchema(error.message) ? DIGEST_MIGRATION_HINT : error.message,
      };
    }

    const buckets = new Map<string, DigestReviewStory[]>();
    for (const section of DIGEST_SECTIONS) buckets.set(section, []);

    for (const row of (data ?? []) as StoryRow[]) {
      const story: DigestReviewStory = {
        id: row.id,
        headline: row.headline,
        url: row.url,
        body: digestPostBody(row.synopsis, row.paper, row.state),
      };
      const key = isDigestSection(row.section) ? row.section : row.section;
      const list = buckets.get(key) ?? [];
      list.push(story);
      buckets.set(key, list);
    }

    const groups: DigestReviewGroup[] = DIGEST_SECTIONS.map((section) => ({
      section,
      stories: buckets.get(section) ?? [],
    })).filter((group) => group.stories.length > 0);

    for (const [section, stories] of buckets) {
      if (!isDigestSection(section) && stories.length > 0) {
        groups.push({ section, stories });
      }
    }

    review.groups = groups;
    const listed = groups.reduce((sum, group) => sum + group.stories.length, 0);
    const reported = dates.find((row) => row.date === selectedDate)?.pendingCount ?? listed;
    review.pendingCount = listed;
    review.moreWaiting = Math.max(0, reported - listed);
    return review;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load digest stories.";
    console.error("Error loading the digest review:", message);
    return {
      ...emptyReview,
      loadError: missingDigestSchema(message) ? DIGEST_MIGRATION_HINT : message,
    };
  }
}
