import { PinataSDK } from "pinata-web3";
import { TokenServiceError } from "./solana/types";

let pinataInstance: PinataSDK | null = null;

function getPinata(): PinataSDK {
  const jwt = process.env.NEXT_PUBLIC_PINATA_JWT;
  if (!jwt) {
    throw new TokenServiceError(
      "Pinata is not configured. Add NEXT_PUBLIC_PINATA_JWT to your environment.",
      "INVALID_INPUT"
    );
  }
  if (!pinataInstance) {
    const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || "gateway.pinata.cloud";
    pinataInstance = new PinataSDK({ pinataJwt: jwt, pinataGateway: gateway });
  }
  return pinataInstance;
}

export function isPinataConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_PINATA_JWT;
}

export async function uploadImageToIpfs(
  file: File
): Promise<{ cid: string; ipfsUri: string; gatewayUrl: string }> {
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  if (file.size > MAX_SIZE) {
    throw new TokenServiceError(
      `Image too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 5MB.`,
      "INVALID_INPUT"
    );
  }

  const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new TokenServiceError(
      `Unsupported file type: ${file.type}. Use PNG, JPG, WebP, SVG, or GIF.`,
      "INVALID_INPUT"
    );
  }

  const pinata = getPinata();
  const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || "gateway.pinata.cloud";

  try {
    const result = await pinata.upload.file(file);
    const cid = result.IpfsHash;
    return {
      cid,
      ipfsUri: `ipfs://${cid}`,
      gatewayUrl: `https://${gateway}/ipfs/${cid}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    if (message.includes("401") || message.includes("Unauthorized")) {
      throw new TokenServiceError(
        "Pinata authentication failed. Check your API key.",
        "UNAUTHORIZED",
        err
      );
    }
    throw new TokenServiceError(
      `Image upload failed: ${message}`,
      "NETWORK_ERROR",
      err
    );
  }
}
