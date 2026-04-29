import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getMint,
  getTokenMetadata,
} from "@solana/spl-token";
import {
  isRegistryConfigured,
  registerMint,
  type RegistryEntry,
} from "@/lib/registry";
import { mintRegisterSchema, walletAuthSchema } from "@/lib/api/schemas";
import { verifyWalletSignature } from "@/lib/api/wallet-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

function getRpcEndpoint(): string {
  const custom = process.env.NEXT_PUBLIC_RPC_ENDPOINT;
  if (custom && custom.length > 0) return custom;
  const network =
    (process.env.NEXT_PUBLIC_SOLANA_NETWORK as "devnet" | "mainnet-beta") ??
    "devnet";
  return network === "mainnet-beta"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com";
}

export async function POST(request: Request) {
  if (!isRegistryConfigured()) {
    return NextResponse.json(
      {
        error:
          "Registry is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN).",
      },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const inputParse = mintRegisterSchema.safeParse(
    (body as Record<string, unknown>)?.input
  );
  if (!inputParse.success) {
    return NextResponse.json(
      { error: "Invalid registration input.", details: inputParse.error.flatten() },
      { status: 400 }
    );
  }

  const authParse = walletAuthSchema.safeParse(
    (body as Record<string, unknown>)?.auth
  );
  if (!authParse.success) {
    return NextResponse.json(
      { error: "Wallet signature required for registration." },
      { status: 401 }
    );
  }

  const input = inputParse.data;
  const auth = authParse.data;

  const authResult = await verifyWalletSignature(auth, "register-mint", input.mint);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const connection = new Connection(getRpcEndpoint(), "confirmed");

  let mintInfo;
  try {
    mintInfo = await getMint(connection, new PublicKey(input.mint), "confirmed", TOKEN_2022_PROGRAM_ID);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Mint ${input.mint} does not exist or is not a Token-2022 mint.`,
      },
      { status: 404 }
    );
  }

  if (!mintInfo.mintAuthority || !mintInfo.mintAuthority.equals(new PublicKey(auth.wallet))) {
    return NextResponse.json(
      {
        error:
          "Wallet is not the mint authority. Registration rejected.",
      },
      { status: 403 }
    );
  }

  let name = "";
  let symbol = "";
  try {
    const metadata = await getTokenMetadata(
      connection,
      new PublicKey(input.mint),
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    if (metadata) {
      name = metadata.name;
      symbol = metadata.symbol;
    }
  } catch {
    // Metadata read failed — non-fatal
  }

  const entry: RegistryEntry = {
    mint: input.mint,
    name,
    symbol,
    creator: auth.wallet,
    assetType: input.assetType,
    imageUri: input.imageUri,
    description: input.description,
    createdAt: Date.now(),
  };

  try {
    await registerMint(entry);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to write to registry." },
      { status: 500 }
    );
  }

  const chain = `solana-${process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet"}`;
  console.info({
    event: "mint.registered",
    chain,
    mint: input.mint,
    actor: auth.wallet,
    assetType: input.assetType,
  });

  return NextResponse.json({ ok: true, entry });
}
