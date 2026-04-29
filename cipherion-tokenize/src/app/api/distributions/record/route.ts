import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { isRegistryConfigured, getClient } from "@/lib/registry";
import { distributionRecordSchema, walletAuthSchema } from "@/lib/api/schemas";
import { verifyWalletSignature } from "@/lib/api/wallet-auth";
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getMint } from "@solana/spl-token";

export const runtime = "nodejs";
export const maxDuration = 30;

const DIST_KEY = (mint: string) => `atlas:dist:${mint}`;
const DIST_ID_KEY = (mint: string, id: string) => `atlas:dist:${mint}:id:${id}`;
const DIST_IDX = "atlas:dist:idx";
const DEDUP_TTL_S = 90 * 24 * 60 * 60; // 90 days

function canonical(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object") {
    const keys = Object.keys(v as object).sort();
    return "{" + keys.map(k => JSON.stringify(k) + ":" + canonical((v as Record<string, unknown>)[k])).join(",") + "}";
  }
  return JSON.stringify(v);
}

function canonicalHash(record: Record<string, unknown>): string {
  return createHash("sha256").update(canonical(record)).digest("hex");
}

function getRpcEndpoint(): string {
  const custom = process.env.NEXT_PUBLIC_RPC_ENDPOINT;
  if (custom && custom.length > 0) return custom;
  const network = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as string) ?? "devnet";
  return network === "mainnet-beta"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com";
}

export async function POST(request: Request) {
  if (!isRegistryConfigured()) {
    return NextResponse.json(
      { error: "Server persistence not configured. Distribution saved locally only." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const recordParse = distributionRecordSchema.safeParse(
    (body as Record<string, unknown>)?.record
  );
  if (!recordParse.success) {
    return NextResponse.json(
      { error: "Invalid distribution record.", details: recordParse.error.flatten() },
      { status: 400 }
    );
  }

  const authParse = walletAuthSchema.safeParse(
    (body as Record<string, unknown>)?.auth
  );
  if (!authParse.success) {
    return NextResponse.json(
      { error: "Invalid auth payload.", details: authParse.error.flatten() },
      { status: 400 }
    );
  }

  const record = recordParse.data;
  const auth = authParse.data;

  const authResult = await verifyWalletSignature(auth, "distribution", record.mintAddress);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const connection = new Connection(getRpcEndpoint(), "confirmed");
  let mintInfo;
  try {
    mintInfo = await getMint(connection, new PublicKey(record.mintAddress), "confirmed", TOKEN_2022_PROGRAM_ID);
  } catch {
    return NextResponse.json(
      { error: `Mint ${record.mintAddress} not found on-chain.` },
      { status: 404 }
    );
  }

  if (!mintInfo.mintAuthority || !mintInfo.mintAuthority.equals(new PublicKey(auth.wallet))) {
    return NextResponse.json(
      { error: "Wallet is not the mint authority. Distribution record rejected." },
      { status: 403 }
    );
  }

  const redis = getClient();
  const listKey = DIST_KEY(record.mintAddress);
  const idKey = DIST_ID_KEY(record.mintAddress, record.id);
  const hash = canonicalHash(record as unknown as Record<string, unknown>);

  const reserved = await redis.set(idKey, hash, { nx: true, ex: DEDUP_TTL_S });
  if (!reserved) {
    const existingHash = await redis.get<string>(idKey);
    if (existingHash === hash) {
      return NextResponse.json({ ok: true, dedup: true });
    }
    return NextResponse.json(
      { error: `Distribution id ${record.id} already exists with different payload.` },
      { status: 409 }
    );
  }

  const pipeline = redis.pipeline();
  pipeline.lpush(listKey, JSON.stringify(record));
  pipeline.zadd(DIST_IDX, { score: record.timestamp, member: record.mintAddress });
  await pipeline.exec();

  const chain = `solana-${process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet"}`;
  console.info({
    event: "distribution.recorded",
    chain,
    mint: record.mintAddress,
    id: record.id,
    actor: auth.wallet,
    recipientCount: record.recipients.length,
    status: record.status,
  });

  return NextResponse.json({ ok: true });
}
