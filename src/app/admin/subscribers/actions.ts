"use server";

import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/admin-session";

export type SubscriberActionResult = { ok: true } | { ok: false; error: string };

const SUBSCRIBER_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function removeNewsletterSubscriber(id: string): Promise<SubscriberActionResult> {
  if (!SUBSCRIBER_ID.test(id)) {
    return { ok: false, error: "That subscriber could not be found." };
  }

  const { supabase, error } = await adminClient();
  if (error || !supabase) {
    return { ok: false, error: error ?? "You need an admin account to do that." };
  }

  const { data, error: deleteError } = await supabase
    .from("newsletter_subscribers")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (deleteError) {
    console.error("Could not delete a newsletter subscriber:", deleteError.message);
    return { ok: false, error: "That subscriber could not be removed." };
  }
  if (!data) return { ok: false, error: "That subscriber could not be found." };

  revalidatePath("/admin");
  revalidatePath("/admin/subscribers");
  return { ok: true };
}
