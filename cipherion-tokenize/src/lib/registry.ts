import { Redis } from "@upstash/redis";

export interface RegistryEntry {
  mint: string;
  name: string;
  symbol: string;
  creator: string;
  assetType: string;
  imageUri: string;
  description: string;
  createdAt: number;
}

const INDEX_KEY = "atlas:mints:sorted";
const entryKey = (mint: string) => `atlas:mint:${mint}`;

let client: Redis | null = null;

function resolveCreds(): { url: string; token: string } | null {
  const url =
    process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "";
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
  if (!url || !token) return null;
  return { url, token };
}

export function getClient(): Redis {
  if (client) return client;
  const creds = resolveCreds();
  if (!creds) {
    throw new Error(
      "Registry is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN (Vercel Upstash integration) or UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (Upstash direct)."
    );
  }
  client = new Redis(creds);
  return client;
}

export function isRegistryConfigured(): boolean {
  return resolveCreds() !== null;
}

export async function registerMint(entry: RegistryEntry): Promise<void> {
  const redis = getClient();
  const pipeline = redis.pipeline();
  pipeline.set(entryKey(entry.mint), JSON.stringify(entry));
  pipeline.zadd(INDEX_KEY, { score: entry.createdAt, member: entry.mint });
  await pipeline.exec();
}

export async function listMints(): Promise<RegistryEntry[]> {
  const redis = getClient();
  const addresses = await redis.zrange<string[]>(INDEX_KEY, 0, -1, { rev: true });
  if (!addresses || addresses.length === 0) return [];

  const keys = addresses.map(entryKey);
  const rawEntries = await redis.mget<(string | RegistryEntry | null)[]>(...keys);
  const entries: RegistryEntry[] = [];
  for (const raw of rawEntries) {
    if (!raw) continue;
    if (typeof raw === "string") {
      try {
        entries.push(JSON.parse(raw));
      } catch {
        continue;
      }
    } else {
      entries.push(raw);
    }
  }
  return entries;
}

export async function getMintEntry(mint: string): Promise<RegistryEntry | null> {
  const redis = getClient();
  const raw = await redis.get<string | RegistryEntry | null>(entryKey(mint));
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

/**
 * Flush the entire catalog. Deletes the sorted-set index and all mint entries.
 * Used for demo resets — does NOT affect on-chain state.
 */
export async function flushRegistry(): Promise<number> {
  const redis = getClient();
  const addresses = await redis.zrange<string[]>(INDEX_KEY, 0, -1);
  if (!addresses || addresses.length === 0) {
    await redis.del(INDEX_KEY);
    return 0;
  }
  const keys = addresses.map(entryKey);
  const pipeline = redis.pipeline();
  for (const key of keys) {
    pipeline.del(key);
  }
  pipeline.del(INDEX_KEY);
  await pipeline.exec();
  return addresses.length;
}
