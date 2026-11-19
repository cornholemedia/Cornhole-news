import { revalidatePath } from "next/cache";

/** Refresh the public story pages after a publish, edit, or delete. */
export function revalidatePublicStories(postId?: number) {
  revalidatePath("/");
  revalidatePath("/no-politics");
  revalidatePath("/new");
  revalidatePath("/p/[page]", "page");
  revalidatePath("/no-politics/p/[page]", "page");
  revalidatePath("/sitemap.xml");
  revalidatePath("/rss.xml");
  revalidatePath("/feed");
  if (postId != null && Number.isInteger(postId) && postId > 0) {
    revalidatePath(`/item/${postId}`);
  }
}

export function revalidateUserProfile(username: string) {
  const name = username.trim();
  if (!name) return;
  revalidatePath(`/user/${encodeURIComponent(name)}`);
}
