import { type NextRequest, NextResponse } from "next/server";
import { isRegistryConfigured, listMints } from "@/lib/registry";

export const runtime = "nodejs";

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

  try {
    const entries = await listMints();

    // Optional filter: ?creator=<wallet> returns only mints by that authority
    const creator = request.nextUrl.searchParams.get("creator");
    const filtered = creator
      ? entries.filter((e) => e.creator === creator)
      : entries;

    return NextResponse.json({ configured: true, entries: filtered });
  } catch (err) {
    return NextResponse.json(
      {
        configured: true,
        error: err instanceof Error ? err.message : "Failed to load registry",
        entries: [],
      },
      { status: 500 }
    );
  }
}
