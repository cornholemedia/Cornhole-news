"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setUserBanned(
  userId: string,
  username: string,
  banned: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    return { ok: false, error: "That account was not found." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_profile_banned", {
    p_user_id: userId,
    p_banned: banned,
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("cannot ban your own")) {
      return { ok: false, error: "You cannot ban your own account." };
    }
    if (message.includes("not allowed") || message.includes("42501")) {
      return { ok: false, error: "You cannot change that account." };
    }
    console.error("Could not update ban:", error.message);
    return { ok: false, error: "Could not update that account. Please try again." };
  }

  revalidatePath(`/user/${encodeURIComponent(username)}`);
  return { ok: true };
}
