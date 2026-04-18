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

interface RegisterBody {
  mint?: string;
  creator?: string;
  assetType?: string;
  imageUri?: string;
  description?: string;
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

  let body: RegisterBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { mint: mintAddress, creator, assetType, imageUri, description } = body;
  if (!mintAddress || !creator || !assetType) {
    return NextResponse.json(
      { error: "Missing required fields: mint, creator, assetType." },
      { status: 400 }
    );
  }

  let mintPk: PublicKey;
  let creatorPk: PublicKey;
  try {
    mintPk = new PublicKey(mintAddress);
    creatorPk = new PublicKey(creator);
  } catch {
    return NextResponse.json(
      { error: "Invalid mint or creator public key." },
      { status: 400 }
    );
  }

  const connection = new Connection(getRpcEndpoint(), "confirmed");

  // On-chain verification: the mint must exist, be Token-2022, and have
  // the claimed creator as mint authority. This prevents spam registrations.
  let mintInfo;
  try {
    mintInfo = await getMint(connection, mintPk, "confirmed", TOKEN_2022_PROGRAM_ID);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Mint ${mintAddress} does not exist or is not a Token-2022 mint.`,
        detail: err instanceof Error ? err.message : "lookup failed",
      },
      { status: 404 }
    );
  }

  if (!mintInfo.mintAuthority || !mintInfo.mintAuthority.equals(creatorPk)) {
    return NextResponse.json(
      {
        error:
          "Creator does not match the on-chain mint authority. Registration rejected.",
      },
      { status: 403 }
    );
  }

  // Pull name/symbol from on-chain metadata as source of truth — don't trust
  // client-supplied values for display fields.
  let name = "";
  let symbol = "";
  try {
    const metadata = await getTokenMetadata(
      connection,
      mintPk,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    if (metadata) {
      name = metadata.name;
      symbol = metadata.symbol;
    }
  } catch {
    // Metadata read failed — non-fatal. Proceed with empty display fields;
    // the Explorer UI handles empty name/symbol gracefully.
  }

  const entry: RegistryEntry = {
    mint: mintAddress,
    name,
    symbol,
    creator,
    assetType,
    imageUri: imageUri ?? "",
    description: description ?? "",
    createdAt: Date.now(),
  };

  try {
    await registerMint(entry);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to write to registry.",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, entry });
}
