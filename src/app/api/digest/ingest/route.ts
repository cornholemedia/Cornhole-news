import { NextRequest, NextResponse } from "next/server";
import {
  DIGEST_MIN_SECRET_LENGTH,
  bearerMatches,
  missingDigestSchema,
  parseIngestPayload,
} from "@/lib/digest";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 500_000;

function json(body: { error: string } | Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function readLimitedBody(request: NextRequest): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    received += value.byteLength;
    if (received > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks).toString("utf8");
}

export async function POST(request: NextRequest) {
  const secret = process.env.DIGEST_INGEST_SECRET?.trim() ?? "";
  if (secret.length < DIGEST_MIN_SECRET_LENGTH) {
    console.error("Digest ingest is not configured: DIGEST_INGEST_SECRET is missing or too short.");
    return json({ error: "Digest ingest is not configured." }, 503);
  }

  if (!bearerMatches(request.headers.get("authorization"), secret)) {
    return json({ error: "Unauthorized." }, 401);
  }

  const supabase = createServiceClient();
  if (!supabase) {
    console.error("Digest ingest is not configured: SUPABASE_SERVICE_ROLE_KEY is missing or unusable.");
    return json({ error: "Digest ingest is not configured." }, 503);
  }

  const rawBody = await readLimitedBody(request);
  if (rawBody === null) {
    return json({ error: "That digest is too large." }, 413);
  }

  let parsedJson: unknown;
  try {
    parsedJson = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return json({ error: "Send a JSON object with digest_date and stories." }, 400);
  }

  const parsed = parseIngestPayload(parsedJson);
  if (!parsed.ok) {
    return json({ error: parsed.error }, 400);
  }

  const { data, error } = await supabase.rpc("ingest_digest_stories", {
    p_digest_date: parsed.value.digestDate,
    p_stories: parsed.value.stories,
  });

  if (error) {
    console.error("Digest ingest failed:", error.message);
    if (error.message.startsWith("digest:")) {
      return json({ error: error.message.slice("digest:".length).trim() }, 400);
    }
    if (missingDigestSchema(error.message)) {
      return json(
        {
          error:
            "Digest storage is not ready. Run supabase/migrations/20261013_digest_stories.sql in the Supabase SQL editor.",
        },
        503
      );
    }
    return json({ error: "Could not save that digest." }, 500);
  }

  const result = (data ?? {}) as { inserted?: number; updated?: number; skipped?: number };
  return json(
    {
      ok: true,
      digest_date: parsed.value.digestDate,
      inserted: Number(result.inserted) || 0,
      updated: Number(result.updated) || 0,
      skipped: Number(result.skipped) || 0,
    },
    200
  );
}
