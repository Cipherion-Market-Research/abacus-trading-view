import { NextResponse } from "next/server";
import { isRegistryConfigured, getClient, flushRegistry } from "@/lib/registry";
import { walletAuthSchema } from "@/lib/api/schemas";
import { verifyWalletSignature } from "@/lib/api/wallet-auth";

export const runtime = "nodejs";

const DIST_IDX = "atlas:dist:idx";
const REG_IDX = "atlas:reg:idx";
const RESET_RATE_KEY = (wallet: string) => `atlas:reset-rate:${wallet}`;
const RESET_RATE_TTL_S = 3600; // 1 hour

async function flushByIndex(indexKey: string, prefix: string): Promise<number> {
  const redis = getClient();
  const members = await redis.zrange<string[]>(indexKey, 0, -1);
  if (!members || members.length === 0) {
    await redis.del(indexKey);
    return 0;
  }

  const pipeline = redis.pipeline();

  if (prefix === "atlas:dist:") {
    for (const mint of members) {
      const listKey = `${prefix}${mint}`;
      const entries = await redis.lrange<string>(listKey, 0, -1);
      for (const raw of entries) {
        try {
          const rec = typeof raw === "string" ? JSON.parse(raw) : raw;
          if (rec?.id) pipeline.del(`${prefix}${mint}:id:${rec.id}`);
        } catch { /* skip malformed */ }
      }
      pipeline.del(listKey);
    }
  } else {
    for (const member of members) {
      pipeline.del(`${prefix}${member}`);
      if (prefix === "atlas:reg:") {
        pipeline.del(`atlas:reg:${member}:version`);
      }
    }
  }

  pipeline.del(indexKey);
  await pipeline.exec();
  return members.length;
}

export async function POST(request: Request) {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet";
  if (network === "mainnet-beta") {
    return NextResponse.json(
      { error: "Demo reset is disabled on mainnet." },
      { status: 403 }
    );
  }

  if (!isRegistryConfigured()) {
    return NextResponse.json(
      { error: "Server persistence not configured." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const authParse = walletAuthSchema.safeParse(
    (body as Record<string, unknown>)?.auth
  );
  if (!authParse.success) {
    return NextResponse.json(
      { error: "Wallet signature required for demo reset." },
      { status: 401 }
    );
  }

  const auth = authParse.data;
  const authResult = await verifyWalletSignature(auth, "demo-reset", "global");
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const redis = getClient();
  if (network !== "devnet") {
    const rateKey = RESET_RATE_KEY(auth.wallet);
    const allowed = await redis.set(rateKey, "1", { nx: true, ex: RESET_RATE_TTL_S });
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limited — one reset per wallet per hour." },
        { status: 429 }
      );
    }
  }

  try {
    const [catalogCount, distCount, regCount] = await Promise.all([
      flushRegistry(),
      flushByIndex(DIST_IDX, "atlas:dist:"),
      flushByIndex(REG_IDX, "atlas:reg:"),
    ]);

    const chain = `solana-${network}`;
    console.info({
      event: "demo.reset",
      chain,
      actor: auth.wallet,
      flushed: { catalog: catalogCount, distributions: distCount, registers: regCount },
    });

    return NextResponse.json({
      ok: true,
      flushed: { catalog: catalogCount, distributions: distCount, registers: regCount },
    });
  } catch {
    return NextResponse.json(
      { error: "Reset failed." },
      { status: 500 }
    );
  }
}
