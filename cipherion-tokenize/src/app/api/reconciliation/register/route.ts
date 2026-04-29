import { NextResponse } from "next/server";
import { z } from "zod";
import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getMint } from "@solana/spl-token";
import { isRegistryConfigured, getClient } from "@/lib/registry";
import { registerUploadSchema, walletAuthSchema } from "@/lib/api/schemas";
import { verifyWalletSignature } from "@/lib/api/wallet-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

const REG_KEY = (mint: string) => `atlas:reg:${mint}`;
const REG_VER = (mint: string) => `atlas:reg:${mint}:version`;
const REG_IDX = "atlas:reg:idx";

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

  const regParse = registerUploadSchema.safeParse(
    (body as Record<string, unknown>)?.register
  );
  if (!regParse.success) {
    return NextResponse.json(
      { error: "Invalid register payload.", details: regParse.error.flatten() },
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

  const reg = regParse.data;
  const auth = authParse.data;

  const authResult = await verifyWalletSignature(auth, "register", reg.mint);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const connection = new Connection(getRpcEndpoint(), "confirmed");
  let mintInfo;
  try {
    mintInfo = await getMint(connection, new PublicKey(reg.mint), "confirmed", TOKEN_2022_PROGRAM_ID);
  } catch {
    return NextResponse.json(
      { error: `Mint ${reg.mint} not found on-chain.` },
      { status: 404 }
    );
  }

  if (!mintInfo.mintAuthority || !mintInfo.mintAuthority.equals(new PublicKey(auth.wallet))) {
    return NextResponse.json(
      { error: "Wallet is not the mint authority. Register upload rejected." },
      { status: 403 }
    );
  }

  const redis = getClient();
  const now = Date.now();

  const version = await redis.incr(REG_VER(reg.mint));

  const doc = {
    version,
    uploadedAt: now,
    uploadedBy: auth.wallet,
    entries: reg.entries,
  };

  const pipeline = redis.pipeline();
  pipeline.set(REG_KEY(reg.mint), JSON.stringify(doc));
  pipeline.zadd(REG_IDX, { score: now, member: reg.mint });
  await pipeline.exec();

  const chain = `solana-${process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet"}`;
  console.info({
    event: "register.uploaded",
    chain,
    mint: reg.mint,
    version,
    uploadedBy: auth.wallet,
    entryCount: reg.entries.length,
  });

  return NextResponse.json({ ok: true, version });
}

export interface RegisterDocument {
  version: number;
  uploadedAt: number;
  uploadedBy: string;
  entries: { address: string; balance: string; status: "active" | "frozen" }[];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mintRaw = searchParams.get("mint");

  const mintParam = z.string().min(32).max(44);
  const parsed = mintParam.safeParse(mintRaw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing or invalid ?mint= parameter." }, { status: 400 });
  }
  const mint = parsed.data;

  if (!isRegistryConfigured()) {
    return NextResponse.json({ register: null, configured: false });
  }

  try {
    const redis = getClient();
    const raw = await redis.get<string | RegisterDocument | null>(REG_KEY(mint));

    if (!raw) {
      return NextResponse.json({ register: null, configured: true });
    }

    const doc: RegisterDocument = typeof raw === "string" ? JSON.parse(raw) : raw;
    return NextResponse.json({ register: doc, configured: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to read register." },
      { status: 500 }
    );
  }
}
