"use server";

import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/admin-session";
import { isPageSlug } from "@/lib/page-content";

/** Refresh a public editable page after an admin saves it. */
export async function revalidateEditedPage(slug: string): Promise<void> {
  if (!isPageSlug(slug)) return;
  const { error } = await adminClient();
  if (error) return;

  revalidatePath(`/${slug}`);
  if (slug === "jobs") {
    revalidatePath("/jobs");
    revalidatePath("/jobs/state/[code]", "page");
  }
}
