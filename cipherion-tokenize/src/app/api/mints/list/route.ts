import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isRegistryConfigured, listMints } from "@/lib/registry";

export const runtime = "nodejs";

const creatorParam = z.string().min(32).max(44).optional();

export async function GET(request: NextRequest) {
  if (!isRegistryConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        error:
          "Registry is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN).",
        entries: [],
      },
      { status: 503 }
    );
  }

  const creatorRaw = request.nextUrl.searchParams.get("creator") ?? undefined;
  const parsed = creatorParam.safeParse(creatorRaw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid ?creator= parameter.", entries: [] },
      { status: 400 }
    );
  }
  const creator = parsed.data;

  try {
    const entries = await listMints();
    const filtered = creator
      ? entries.filter((e) => e.creator === creator)
      : entries;

    return NextResponse.json({ configured: true, entries: filtered });
  } catch {
    return NextResponse.json(
      {
        configured: true,
        error: "Failed to load registry.",
        entries: [],
      },
      { status: 500 }
    );
  }
}
