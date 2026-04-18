import { NextResponse } from "next/server";
import { isRegistryConfigured, listMints } from "@/lib/registry";

export const runtime = "nodejs";

export async function GET() {
  if (!isRegistryConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        error:
          "Registry is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
        entries: [],
      },
      { status: 503 }
    );
  }

  try {
    const entries = await listMints();
    return NextResponse.json({ configured: true, entries });
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
