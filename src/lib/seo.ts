import type { Metadata } from "next";
import { SITE_NAME, getSiteUrl } from "@/lib/site";

const SHARE_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Cornhole News — news, discussion, and community",
};

export function summarize(text: string, max = 160): string {
  const plain = text
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^note:\s*/gim, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  if (!plain) return "";
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max - 1).trimEnd()}…`;
}

export function pageMeta(options: {
  title: string;
  description: string;
  path: string;
  absoluteTitle?: boolean;
  noIndex?: boolean;
  ogType?: "website" | "article";
}): Metadata {
  const { title, description, path, absoluteTitle, noIndex, ogType = "website" } = options;
  const siteUrl = getSiteUrl();
  const url = path === "/" ? siteUrl : `${siteUrl}${path}`;
  const branded = absoluteTitle || title.includes(SITE_NAME);

  return {
    title: branded ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: ogType,
      locale: "en_US",
      images: [SHARE_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [SHARE_IMAGE.url],
    },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}
