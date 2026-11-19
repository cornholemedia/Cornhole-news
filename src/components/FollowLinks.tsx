import { RSS_PATH } from "@/lib/rss";
import { X_PROFILE_URL } from "@/lib/site";

function RssIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <circle cx="6.2" cy="17.8" r="2.7" fill="currentColor" />
      <path
        d="M4 9.2a10.8 10.8 0 0 1 10.8 10.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M4 4.2a15.8 15.8 0 0 1 15.8 15.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path
        fill="currentColor"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      />
    </svg>
  );
}

export default function FollowLinks({ variant = "footer" }: { variant?: "header" | "footer" }) {
  const inHeader = variant === "header";
  const className = inHeader
    ? "inline-flex h-8 w-8 items-center justify-center rounded border border-[#3f679b]/40 bg-white/70 text-[#3f679b] hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3f679b]"
    : "inline-flex items-center gap-1.5 text-[#3f679b] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3f679b]";
  const Tag = inHeader ? "div" : "nav";

  return (
    <Tag
      aria-label={inHeader ? undefined : "Subscribe and follow"}
      className={inHeader ? "flex items-center gap-1.5" : "flex items-center justify-center gap-4"}
    >
      <a href={RSS_PATH} className={className} aria-label="Cornhole News RSS feed">
        <RssIcon />
        {inHeader ? null : <span>RSS</span>}
      </a>
      <a
        href={X_PROFILE_URL}
        className={className}
        aria-label="Cornhole News on X"
        target="_blank"
        rel="noopener noreferrer"
      >
        <XIcon />
        {inHeader ? null : <span>X</span>}
      </a>
    </Tag>
  );
}
