export const PAGE_SLUGS = ["about", "jobs", "advertise"] as const;

export type PageSlug = (typeof PAGE_SLUGS)[number];

export type PageVariant = "prose" | "card";

export type StaticPageContent = {
  slug: PageSlug;
  title: string;
  subtitle: string;
  body: string;
};

export type EditablePage = StaticPageContent & {
  stored: boolean;
  updatedAt: string | null;
  loadError: string | null;
};

export type PagePresentation = {
  variant: PageVariant;
  subtitleClass: string;
  cardClass: string;
  headingClass: string;
};

export const PAGE_PRESENTATION: Record<PageSlug, PagePresentation> = {
  about: {
    variant: "prose",
    subtitleClass: "mb-6 text-[15px] leading-relaxed",
    cardClass: "",
    headingClass: "mb-2 text-lg font-semibold",
  },
  jobs: {
    variant: "card",
    subtitleClass: "mb-6 text-[15px] text-[#666]",
    cardClass: "rounded border border-[#e0e0e0] bg-white p-4",
    headingClass: "font-semibold",
  },
  advertise: {
    variant: "card",
    subtitleClass: "mb-6 text-[15px] leading-relaxed",
    cardClass: "rounded border border-[#e0e0e0] bg-white p-5",
    headingClass: "text-lg font-semibold",
  },
};

export const DEFAULT_PAGES: Record<PageSlug, Omit<StaticPageContent, "slug">> = {
  about: {
    title: "About Cornhole News",
    subtitle: "",
    body: `Cornhole News is a community-driven site for news, discussion, and everything related to the game of cornhole.

Whether you play in your backyard, compete in local leagues, or follow the professional tours, this is a place to share links, ask questions, and talk about the game.

The site is inspired by classic link aggregators and is built to stay simple, fast, and focused on the content.`,
  },
  jobs: {
    title: "Jobs",
    subtitle: "Cornhole-related job openings and opportunities.",
    body: `## No jobs posted yet

note: Check back later, or [contact us](/advertise) if you'd like to post a position.`,
  },
  advertise: {
    title: "Advertise on Cornhole News",
    subtitle:
      "Reach an engaged audience of cornhole players, fans, league organizers, and gear enthusiasts.",
    body: `## Ad Placements

- **Sidebar 300×250** — Standard medium rectangle
- **Sidebar 300×600** — Tall skyscraper unit

Interested in advertising? Reach out and we'll get back to you with rates and availability.

note: (Contact form / email will be added here once the site is live.)`,
  },
};

export function isPageSlug(value: string): value is PageSlug {
  return (PAGE_SLUGS as readonly string[]).includes(value);
}

export function defaultPage(slug: PageSlug): StaticPageContent {
  return { slug, ...DEFAULT_PAGES[slug] };
}

export type Inline =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "link"; label: string; href: string };

export type Block =
  | { type: "heading"; level: 2 | 3; inlines: Inline[] }
  | { type: "paragraph"; inlines: Inline[] }
  | { type: "list"; items: Inline[][] }
  | { type: "note"; inlines: Inline[] };

const INLINE_PATTERN = /(\*\*([^*]+)\*\*)|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (!href || href.length > 2000) return null;

  if (href.startsWith("/") && !href.startsWith("//") && !href.includes("\\") && !href.includes("://")) {
    return href;
  }

  try {
    const url = new URL(href);
    if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:") {
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
}

export function parseInlines(input: string): Inline[] {
  const tokens: Inline[] = [];
  const pattern = new RegExp(INLINE_PATTERN.source, "g");
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input))) {
    if (match.index > last) {
      tokens.push({ type: "text", value: input.slice(last, match.index) });
    }

    if (match[1]) {
      tokens.push({ type: "bold", value: match[2] });
    } else {
      const href = safeHref(match[4]);
      if (href) {
        tokens.push({ type: "link", label: match[3], href });
      } else {
        tokens.push({ type: "text", value: match[0] });
      }
    }

    last = match.index + match[0].length;
  }

  if (last < input.length) {
    tokens.push({ type: "text", value: input.slice(last) });
  }

  return tokens.length > 0 ? tokens : [{ type: "text", value: "" }];
}

function isSpecialLine(line: string): boolean {
  return (
    line.startsWith("## ") ||
    line.startsWith("### ") ||
    line.startsWith("- ") ||
    line.startsWith("* ") ||
    line.startsWith("note:")
  );
}

export function parsePageBody(body: string): Block[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "") {
      index += 1;
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push({
        type: "heading",
        level: 3,
        inlines: parseInlines(line.slice(4).trim()),
      });
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push({
        type: "heading",
        level: 2,
        inlines: parseInlines(line.slice(3).trim()),
      });
      index += 1;
      continue;
    }

    if (line.startsWith("note:")) {
      blocks.push({ type: "note", inlines: parseInlines(line.slice(5).trim()) });
      index += 1;
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: Inline[][] = [];
      while (
        index < lines.length &&
        (lines[index].startsWith("- ") || lines[index].startsWith("* "))
      ) {
        items.push(parseInlines(lines[index].slice(2).trim()));
        index += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() !== "" && !isSpecialLine(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", inlines: parseInlines(paragraph.join(" ")) });
  }

  return blocks;
}

export const TITLE_MAX = 200;
export const SUBTITLE_MAX = 400;
export const BODY_MAX = 20000;
