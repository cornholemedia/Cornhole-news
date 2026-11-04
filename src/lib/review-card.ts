/** Published review cards stay collapsed until the admin expands that card. */
export function reviewStoryCollapsed(
  status: "pending" | "published",
  expanded: boolean
): boolean {
  return status === "published" && !expanded;
}
