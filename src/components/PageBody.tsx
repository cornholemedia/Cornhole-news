import Link from "next/link";
import { parsePageBody, type Inline } from "@/lib/page-content";

function InlineText({ inlines }: { inlines: Inline[] }) {
  return (
    <>
      {inlines.map((part, index) => {
        if (part.type === "bold") {
          return <strong key={index}>{part.value}</strong>;
        }

        if (part.type === "link") {
          const className = "text-[#3f679b] hover:underline";
          if (part.href.startsWith("/")) {
            return (
              <Link key={index} href={part.href} className={className}>
                {part.label}
              </Link>
            );
          }

          return (
            <a
              key={index}
              href={part.href}
              className={className}
              target="_blank"
              rel="noopener noreferrer"
            >
              {part.label}
            </a>
          );
        }

        return <span key={index}>{part.value}</span>;
      })}
    </>
  );
}

export default function PageBody({
  body,
  headingClass,
}: {
  body: string;
  headingClass: string;
}) {
  const blocks = parsePageBody(body);
  if (blocks.length === 0) return null;

  return (
    <div>
      {blocks.map((block, index) => {
        const isLast = index === blocks.length - 1;
        const next = blocks[index + 1];

        if (block.type === "heading") {
          const Tag = block.level === 3 ? "h3" : "h2";
          const margin = isLast ? "" : next?.type === "note" ? "mb-1" : "mb-3";
          return (
            <Tag key={index} className={`${headingClass} ${margin}`}>
              <InlineText inlines={block.inlines} />
            </Tag>
          );
        }

        if (block.type === "list") {
          return (
            <ul
              key={index}
              className={`list-disc space-y-2 pl-5 text-[15px] ${isLast ? "" : "mb-4"}`}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <InlineText inlines={item} />
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "note") {
          return (
            <p key={index} className={`text-sm text-[#666] ${isLast ? "" : "mb-4"}`}>
              <InlineText inlines={block.inlines} />
            </p>
          );
        }

        return (
          <p
            key={index}
            className={`text-[15px] leading-relaxed ${isLast ? "" : "mb-4"}`}
          >
            <InlineText inlines={block.inlines} />
          </p>
        );
      })}
    </div>
  );
}
