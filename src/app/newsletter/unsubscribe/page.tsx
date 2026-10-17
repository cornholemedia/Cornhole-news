import type { Metadata } from "next";
import Link from "next/link";
import { readNewsletterUnsubscribeToken } from "@/lib/unsubscribe";
import { createServiceClient } from "@/lib/supabase/service";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Unsubscribe",
  description: "Stop newsletter email from Cornhole News.",
  path: "/newsletter/unsubscribe",
  noIndex: true,
});

async function unsubscribe(token: string): Promise<"done" | "invalid" | "unavailable"> {
  const email = readNewsletterUnsubscribeToken(token);
  if (!email) return "invalid";

  const supabase = createServiceClient();
  if (!supabase) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is not set. The unsubscribe was not saved.");
    return "unavailable";
  }

  const { error } = await supabase
    .from("newsletter_subscribers")
    .update({ status: "unsubscribed" })
    .eq("email", email);

  if (error) {
    console.error("Could not unsubscribe:", error.message);
    return "unavailable";
  }

  return "done";
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token ? await unsubscribe(token) : "invalid";

  return (
    <div className="mx-auto max-w-lg py-6">
      <h1 className="text-2xl font-bold">Newsletter</h1>
      {result === "done" ? (
        <p className="mt-3 text-[15px] leading-relaxed">
          You&apos;re unsubscribed. We won&apos;t send Midwest news to that address.
        </p>
      ) : null}
      {result === "invalid" ? (
        <p className="mt-3 text-[15px] leading-relaxed">
          That unsubscribe link is not valid. Use the link from a Cornhole News email, or write to
          cornholemedia@gmail.com.
        </p>
      ) : null}
      {result === "unavailable" ? (
        <p className="mt-3 text-[15px] leading-relaxed">
          We could not save that unsubscribe right now. Please try the link again in a few minutes.
        </p>
      ) : null}
      <p className="mt-5 text-[15px]">
        <Link href="/" className="text-[#3f679b] hover:underline">
          Back to Cornhole News
        </Link>
      </p>
    </div>
  );
}
