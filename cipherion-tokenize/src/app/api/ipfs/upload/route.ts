import { NextResponse } from "next/server";
import { PinataSDK } from "pinata-web3";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
];

export async function POST(request: Request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return NextResponse.json(
      { error: "Server is not configured for uploads. PINATA_JWT is missing." },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid multipart form data." },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing 'file' field in upload." },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      {
        error: `Image too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 4MB.`,
      },
      { status: 413 }
    );
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      {
        error: `Unsupported file type: ${file.type}. Use PNG, JPG, WebP, SVG, or GIF.`,
      },
      { status: 415 }
    );
  }

  const gateway =
    process.env.NEXT_PUBLIC_PINATA_GATEWAY || "gateway.pinata.cloud";
  const pinata = new PinataSDK({ pinataJwt: jwt, pinataGateway: gateway });

  try {
    const result = await pinata.upload.file(file);
    const cid = result.IpfsHash;
    return NextResponse.json({
      cid,
      ipfsUri: `ipfs://${cid}`,
      gatewayUrl: `https://${gateway}/ipfs/${cid}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    const status =
      message.includes("401") || message.includes("Unauthorized") ? 502 : 500;
    return NextResponse.json(
      { error: `Pinata upload failed: ${message}` },
      { status }
    );
  }
}
