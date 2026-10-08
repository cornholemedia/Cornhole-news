import { NextResponse } from "next/server";
import { getAllNewsletterSubscribers, subscribersToCsv } from "@/lib/newsletter";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function viewerIsAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  return profile?.is_admin === true;
}

export async function GET() {
  if (!(await viewerIsAdmin())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { rows, error } = await getAllNewsletterSubscribers();
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
