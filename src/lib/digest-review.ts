import "server-only";
import {
  DIGEST_BOT_USERNAME,
  DIGEST_DRIP_HINT,
  DIGEST_MIGRATION_HINT,
  DIGEST_POLITICS_HINT,
  DIGEST_SECTIONS,
  DIGEST_STATE_HINT,
  DIGEST_TWEET_HINT,
  missingDigestPoliticsColumn,
  missingDigestStoryStateColumn,
  missingDigestTweetColumn,
  digestPostBody,
  formatDigestDate,
  isDigestSection,
  isRecentDigestDate,
  missingDigestSchema,
  parseDigestDate,
} from "@/lib/digest";
import { formatReleaseLabel } from "@/lib/drip-schedule";
import { isMidwestState } from "@/lib/midwest-states";
import { digestShareUrl, suggestedTweet } from "@/lib/tweet";
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
  status: "pending" | "published";
  postId: number | null;
  isPolitical: boolean;
  tweetText: string;
  storyState: string | null;
  publishAt: string | null;
  releaseLabel: string;
  scheduled: boolean;
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
  politicsReady: boolean;
  tweetsReady: boolean;
  statesReady: boolean;
  botReady: boolean;
  botIsAdmin: boolean;
  loadError: string | null;
  scheduleHint: string | null;
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
  status: string;
  post_id: number | string | null;
  is_political?: boolean | null;
  tweet_draft?: string | null;
  story_state?: string | null;
};

const emptyReview: DigestReview = {
  dates: [],
  selectedDate: null,
  selectedLabel: null,
  groups: [],
  pendingCount: 0,
  moreWaiting: 0,
  politicsReady: true,
  tweetsReady: true,
  statesReady: true,
  botReady: false,
  botIsAdmin: false,
  loadError: null,
  scheduleHint: null,
};

function choice(date: string, pendingCount: number): DigestDateChoice {
  return { date, label: formatDigestDate(date), pendingCount };
}

function releaseFields(
  status: string,
  postId: number | null,
  releaseByPost: Map<number, string | null>,
  loaded: boolean,
  now: Date
): Pick<DigestReviewStory, "publishAt" | "releaseLabel" | "scheduled"> {
  if (status !== "published" || postId == null) {
    return { publishAt: null, releaseLabel: "", scheduled: false };
  }
  if (!loaded) return { publishAt: null, releaseLabel: "Published", scheduled: false };
  const publishAt = releaseByPost.get(postId) ?? null;
  const release = formatReleaseLabel(publishAt, now);
  return { publishAt, releaseLabel: release.label, scheduled: release.scheduled };
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

    const now = new Date();
    const dates = ((datesResult.data ?? []) as DateRow[])
      .map((row) => choice(String(row.digest_date).slice(0, 10), Number(row.pending_count) || 0))
      .filter((row) => isRecentDigestDate(row.date, now));

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
      politicsReady: true,
      tweetsReady: true,
      statesReady: true,
      // A failed profile lookup should not pretend the author is missing.
      botReady: Boolean(botResult.error) || Boolean(bot?.id),
      botIsAdmin: Boolean(bot?.is_admin),
      loadError: null,
      scheduleHint: null,
    };

    if (!selectedDate) return review;

    let politicsReady = true;
    let tweetsReady = true;
    let statesReady = true;

    const loadStories = (
      includePolitics: boolean,
      includeTweet: boolean,
      includeState: boolean
    ) => {
      const columns = [
        "id",
        "section",
        "headline",
        "url",
        "paper",
        "state",
        "synopsis",
        "status",
        "post_id",
        ...(includePolitics ? ["is_political"] : []),
        ...(includeTweet ? ["tweet_draft"] : []),
        ...(includeState ? ["story_state"] : []),
      ].join(", ");
      return supabase
        .from("digest_stories")
        .select(columns)
        .eq("digest_date", selectedDate)
        .in("status", ["pending", "published"])
        .order("status", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(800);
    };

    let loaded = await loadStories(true, true, true);
    if (loaded.error && missingDigestStoryStateColumn(loaded.error.message)) {
      statesReady = false;
      loaded = await loadStories(true, true, false);
    }
    if (loaded.error && missingDigestTweetColumn(loaded.error.message)) {
      tweetsReady = false;
      loaded = await loadStories(true, false, statesReady);
    }
    if (loaded.error && missingDigestPoliticsColumn(loaded.error.message)) {
      politicsReady = false;
      tweetsReady = false;
      loaded = await loadStories(false, false, statesReady);
    }

    const error = loaded.error;
    const data = (loaded.data ?? null) as StoryRow[] | null;

    const releaseByPost = new Map<number, string | null>();
    let releaseTimesLoaded = false;
    if (!error && data) {
      const postIds = data
        .map((row) => (row.post_id == null ? null : Number(row.post_id)))
        .filter((id): id is number => id != null && Number.isInteger(id) && id > 0);
      if (postIds.length === 0) {
        releaseTimesLoaded = true;
      } else {
        const times = await supabase.from("posts").select("id, publish_at").in("id", postIds);
        if (times.error) {
          console.error("Error loading digest release times:", times.error.message);
          review.scheduleHint =
            /publish_at/i.test(times.error.message) &&
            /column|schema cache|does not exist/i.test(times.error.message)
              ? DIGEST_DRIP_HINT
              : "Release times could not be loaded.";
        } else {
          releaseTimesLoaded = true;
          for (const row of times.data ?? []) {
            const id = Number(row.id);
            if (!Number.isInteger(id)) continue;
            releaseByPost.set(id, typeof row.publish_at === "string" ? row.publish_at : null);
          }
        }
      }
    }

    if (error) {
      console.error("Error loading digest stories:", error.message);
      return {
        ...review,
        politicsReady,
        tweetsReady,
        statesReady,
        loadError: missingDigestStoryStateColumn(error.message)
          ? DIGEST_STATE_HINT
          : missingDigestTweetColumn(error.message)
            ? DIGEST_TWEET_HINT
            : missingDigestPoliticsColumn(error.message)
              ? DIGEST_POLITICS_HINT
              : missingDigestSchema(error.message)
                ? DIGEST_MIGRATION_HINT
                : error.message,
      };
    }

    review.politicsReady = politicsReady;
    review.tweetsReady = tweetsReady;
    review.statesReady = statesReady;

    const buckets = new Map<string, DigestReviewStory[]>();
    for (const section of DIGEST_SECTIONS) buckets.set(section, []);

    for (const row of data ?? []) {
      if (row.status !== "pending" && row.status !== "published") continue;
      const postId = row.post_id == null ? null : Number(row.post_id);
      const storyPostId =
        postId != null && Number.isInteger(postId) && postId > 0 ? postId : null;
      const story: DigestReviewStory = {
        id: row.id,
        headline: row.headline,
        url: row.url,
        body: digestPostBody(row.synopsis, row.paper, row.state),
        status: row.status,
        postId: storyPostId,
        isPolitical: politicsReady && row.is_political === true,
        storyState:
          statesReady && typeof row.story_state === "string" && isMidwestState(row.story_state)
            ? row.story_state
            : null,
        tweetText: suggestedTweet(
          tweetsReady ? row.tweet_draft : null,
          row.headline,
          digestShareUrl({
            status: row.status,
            postId: storyPostId,
            sourceUrl: row.url,
          })
        ),
        ...releaseFields(row.status, storyPostId, releaseByPost, releaseTimesLoaded, now),
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
    const listedPending = groups.reduce(
      (sum, group) => sum + group.stories.filter((story) => story.status === "pending").length,
      0
    );
    const reported = dates.find((row) => row.date === selectedDate)?.pendingCount ?? listedPending;
    review.pendingCount = listedPending;
    review.moreWaiting = Math.max(0, reported - listedPending);
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
