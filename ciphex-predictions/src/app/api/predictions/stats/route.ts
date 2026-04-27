import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { REDIS_KEYS, type PredStatsResponse } from "@/app/predictions/stats-schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const redis = getRedis();

  if (!redis) {
    return NextResponse.json(
      { error: "Stats backend not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const keys = Object.values(REDIS_KEYS);
    const values = await redis.mget<(string | null)[]>(...keys);

    const parsed = Object.fromEntries(
      Object.keys(REDIS_KEYS).map((k, i) => {
        const raw = values[i];
        if (raw === null || raw === undefined) return [k, null];
        return [k, typeof raw === "string" ? JSON.parse(raw) : raw];
      }),
    );

    const hasSummary = parsed.summary !== null;

    if (!hasSummary) {
      return NextResponse.json(
        { error: "No live data available — stats have not been published yet" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const staleCutoff = Date.now() - 15 * 60 * 1000; // 15 min
    const lastFlush = parsed.summary?.lastFlush
      ? new Date(parsed.summary.lastFlush).getTime()
      : 0;
    const isStale = lastFlush < staleCutoff;

    const response: PredStatsResponse = {
      live: !isStale,
      ...(isStale && { staleSince: parsed.summary.lastFlush }),
      summary: parsed.summary,
      tiers: parsed.tiers ?? [],
      bands: parsed.bands ?? [],
      gates: parsed.gates ?? [],
      eras: parsed.eras ?? [],
      tranches: parsed.tranches ?? [],
      wrSeries: parsed.wrSeries ?? [],
      tape: parsed.tape ?? [],
      dashboard: parsed.dashboard ?? {
        wr24h: 0,
        wins24h: 0,
        total24h: 0,
        wrDelta: 0,
        streak: 0,
        streakDuration: "0d 0h",
      },
      dataset: parsed.dataset ?? {
        positions: "—",
        trancheSnapshots: "—",
        preEntrySignals: "—",
        marginSamples: "—",
        postT3Snapshots: "—",
        fillRecords: "—",
      },
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/predictions/stats]", message);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
