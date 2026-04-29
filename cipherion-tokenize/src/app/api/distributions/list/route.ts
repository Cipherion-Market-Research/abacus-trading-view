import { NextResponse } from "next/server";
import { z } from "zod";
import { isRegistryConfigured, getClient } from "@/lib/registry";
import type { DistributionRecordPayload } from "@/lib/api/schemas";

export const runtime = "nodejs";

const mintParam = z.string().min(32).max(44);
const DIST_KEY = (mint: string) => `atlas:dist:${mint}`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mintRaw = searchParams.get("mint");

  const parsed = mintParam.safeParse(mintRaw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing or invalid ?mint= parameter." }, { status: 400 });
  }
  const mint = parsed.data;

  if (!isRegistryConfigured()) {
    return NextResponse.json({ records: [], configured: false });
  }

  try {
    const redis = getClient();
    const raw = await redis.lrange<string>(DIST_KEY(mint), 0, -1);

    const records: DistributionRecordPayload[] = [];
    for (const entry of raw) {
      try {
        const record = typeof entry === "string" ? JSON.parse(entry) : entry;
        records.push(record as DistributionRecordPayload);
      } catch {
        continue;
      }
    }

    return NextResponse.json({ records, configured: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to read distributions." },
      { status: 500 }
    );
  }
}
