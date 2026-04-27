import { Redis } from "@upstash/redis";

function createRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_READ_ONLY_TOKEN ??
    process.env.KV_REST_API_READ_ONLY_TOKEN ??
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    process.env.KV_REST_API_TOKEN;

  if (!url || !token) return null;

  return new Redis({ url, token });
}

let _redis: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (_redis === undefined) _redis = createRedis();
  return _redis;
}
