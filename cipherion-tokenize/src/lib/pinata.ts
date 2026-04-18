import { TokenServiceError } from "./solana/types";

const MAX_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
];

let cachedConfigured: boolean | null = null;

export async function isPinataConfigured(): Promise<boolean> {
  if (cachedConfigured !== null) return cachedConfigured;
  try {
    const res = await fetch("/api/ipfs/status");
    if (!res.ok) {
      cachedConfigured = false;
      return false;
    }
    const data = (await res.json()) as { configured?: boolean };
    cachedConfigured = !!data.configured;
    return cachedConfigured;
  } catch {
    cachedConfigured = false;
    return false;
  }
}

export async function uploadImageToIpfs(
  file: File
): Promise<{ cid: string; ipfsUri: string; gatewayUrl: string }> {
  if (file.size > MAX_SIZE) {
    throw new TokenServiceError(
      `Image too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 4MB.`,
      "INVALID_INPUT"
    );
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new TokenServiceError(
      `Unsupported file type: ${file.type}. Use PNG, JPG, WebP, SVG, or GIF.`,
      "INVALID_INPUT"
    );
  }

  const form = new FormData();
  form.append("file", file);

  let res: Response;
  try {
    res = await fetch("/api/ipfs/upload", { method: "POST", body: form });
  } catch (err) {
    throw new TokenServiceError(
      `Image upload failed: ${err instanceof Error ? err.message : "Network error"}`,
      "NETWORK_ERROR",
      err
    );
  }

  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      // body wasn't JSON — keep default message
    }
    const code =
      res.status === 401 || res.status === 502 ? "UNAUTHORIZED" : "NETWORK_ERROR";
    throw new TokenServiceError(message, code);
  }

  const data = (await res.json()) as {
    cid: string;
    ipfsUri: string;
    gatewayUrl: string;
  };
  return data;
}
