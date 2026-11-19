import { RSS_FEED_PATH, X_PROFILE_URL } from "@/lib/public-links";

function RssIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18A2.18 2.18 0 0 1 6.18 20a2.18 2.18 0 0 1-2.18-2.18 2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66A9.9 9.9 0 0 1 13.9 20h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      />
    </svg>
  );
}

const linkClass =
  "inline-flex items-center gap-1.5 rounded-sm p-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current";

/**
 * RSS and X. Header icons sit on the yellow bar, so they use black.
 * Footer icons sit on the page background, so they use the brand blue.
 */
export default function FollowLinks({ tone }: { tone: "header" | "footer" }) {
  const color =
    tone === "header"
      ? "text-black hover:text-[#3f679b]"
      : "text-[#3f679b] hover:text-black hover:underline";

  return (
    <nav aria-label={tone === "header" ? "Feed and social" : "Follow"} className="flex items-center gap-1">
      <a href={RSS_FEED_PATH} className={`${linkClass} ${color}`} aria-label="RSS feed">
        <RssIcon />
        {tone === "footer" ? <span className="text-sm">RSS</span> : null}
      </a>
      <a
        href={X_PROFILE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`${linkClass} ${color}`}
        aria-label="Cornhole News on X"
      >
        <XIcon />
      </a>
    </nav>
  );
}
