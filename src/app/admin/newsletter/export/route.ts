import { NextResponse, type NextRequest } from "next/server";
import { adminClient } from "@/lib/admin-session";
import {
  getAllNewsletterSubscribers,
  normalizeSubscriberSearch,
  subscribersToCsv,
} from "@/lib/newsletter";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { error: adminError } = await adminClient();
  if (adminError) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const search = normalizeSubscriberSearch(request.nextUrl.searchParams.get("q"));
  const { rows, error } = await getAllNewsletterSubscribers(search);
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return new NextResponse(subscribersToCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="newsletter-subscribers.csv"',
      "Cache-Control": "no-store",
    },
  });
}
