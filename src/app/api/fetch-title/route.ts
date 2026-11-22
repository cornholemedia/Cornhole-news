import { NextRequest, NextResponse } from "next/server";
import { fetchPublicHtml, readResponseText } from "@/lib/safe-fetch";

export const runtime = "nodejs";

const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 8_000;

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCharCode(parseInt(n, 16))
    );
}

function extractTitle(html: string): string | null {
  const og =
    html.match(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i
    ) ||
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["'][^>]*>/i
    );
  if (og?.[1]) return decodeHtmlEntities(og[1]).trim();

  const twitter =
    html.match(
      /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["'][^>]*>/i
    ) ||
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:title["'][^>]*>/i
    );
  if (twitter?.[1]) return decodeHtmlEntities(twitter[1]).trim();

  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (title?.[1]) return decodeHtmlEntities(title[1]).trim();

  return null;
}

function tookTooLong(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}

export async function POST(request: NextRequest) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const body = (await request.json()) as { url?: string };
    const rawUrl = body.url?.trim();
    if (!rawUrl) {
      return NextResponse.json({ error: "URL is required." }, { status: 400 });
    }

    const response = await fetchPublicHtml(rawUrl, controller.signal);

    if (!response.ok) {
      void response.body?.cancel().catch(() => undefined);
      return NextResponse.json(
        { error: `Could not fetch that page (${response.status}).` },
        { status: 422 }
      );
    }

    const contentType = response.headers.get("content-type") || "";
    if (
      contentType &&
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml")
    ) {
      void response.body?.cancel().catch(() => undefined);
      return NextResponse.json(
        { error: "That URL does not look like an HTML page." },
        { status: 422 }
      );
    }

    const html = await readResponseText(response, controller.signal, MAX_BYTES);
    if (!html) {
      return NextResponse.json(
        { error: "Empty response from that URL." },
        { status: 422 }
      );
    }

    const title = extractTitle(html);
    if (!title) {
      return NextResponse.json(
        { error: "No title found on that page." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      title: title.slice(0, 300),
    });
  } catch (err) {
    const message = tookTooLong(err)
      ? "Timed out fetching that URL."
      : err instanceof Error
        ? err.message
        : "Could not generate a title.";
    return NextResponse.json({ error: message }, { status: 400 });
  } finally {
    clearTimeout(timer);
  }
}
