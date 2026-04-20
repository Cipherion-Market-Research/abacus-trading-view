import { NextResponse } from "next/server";
import { isRegistryConfigured, flushRegistry } from "@/lib/registry";

export const runtime = "nodejs";

export async function POST() {
  if (!isRegistryConfigured()) {
    return NextResponse.json(
      { error: "Registry is not configured." },
      { status: 503 }
    );
  }

  try {
    const count = await flushRegistry();
    return NextResponse.json({ ok: true, deleted: count });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Flush failed" },
      { status: 500 }
    );
  }
}
