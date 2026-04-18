"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Loader2, AlertCircle, ImageOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { isValidPublicKey } from "@/lib/utils/validation";
import type { RegistryEntry } from "@/lib/registry";

interface ListResponse {
  configured: boolean;
  entries: RegistryEntry[];
  error?: string;
}

function resolveImageUrl(uri: string): string | null {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) {
    const gateway =
      process.env.NEXT_PUBLIC_PINATA_GATEWAY || "gateway.pinata.cloud";
    return `https://${gateway}/ipfs/${uri.replace("ipfs://", "")}`;
  }
  return uri;
}

function TokenCard({ entry }: { entry: RegistryEntry }) {
  const imageUrl = resolveImageUrl(entry.imageUri);
  return (
    <Link
      href={`/explorer/${entry.mint}`}
      className="group rounded-lg border border-[#30363d] bg-[#161b22] p-4 transition-colors hover:border-[#484f58] hover:bg-[#1c232c]"
    >
      <div className="flex items-start gap-3">
        <div className="size-12 shrink-0 rounded-lg border border-[#30363d] bg-[#0d1117] overflow-hidden flex items-center justify-center">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={entry.name || entry.symbol}
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageOff className="size-5 text-[#484f58]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-semibold text-[#f0f6fc] truncate">
              {entry.name || "Unnamed"}
            </h3>
            <span className="font-mono text-xs text-[#8b949e] shrink-0">
              {entry.symbol}
            </span>
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-[#8b949e] truncate">
            {entry.mint}
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-[rgba(88,166,255,0.15)] px-2 py-0.5 text-[10px] font-medium text-[#58a6ff] capitalize">
              {entry.assetType.replace(/_/g, " ")}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function ExplorerPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<RegistryEntry[] | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/mints/list");
        const data = (await res.json()) as ListResponse;
        if (cancelled) return;
        setConfigured(data.configured);
        setEntries(data.entries ?? []);
        if (!res.ok && data.error) setError(data.error);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load catalog");
        setEntries([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!entries) return [];
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.symbol.toLowerCase().includes(q) ||
        e.mint.toLowerCase().includes(q) ||
        e.assetType.toLowerCase().includes(q)
    );
  }, [entries, query]);

  const handleDirectLookup = () => {
    const trimmed = query.trim();
    if (isValidPublicKey(trimmed)) {
      router.push(`/explorer/${trimmed}`);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-xl font-semibold text-[#f0f6fc] mb-1">
        Atlas Token Catalog
      </h1>
      <p className="text-sm text-[#8b949e] mb-6">
        Public directory of every RWA token created through CipheX Atlas. No
        wallet required.
      </p>

      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#8b949e]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleDirectLookup()}
            placeholder="Search by name, symbol, asset type, or paste a mint address"
            className="pl-9 border-[#30363d] bg-[#161b22] text-[#f0f6fc] placeholder:text-[#484f58]"
          />
        </div>
      </div>

      {configured === false && (
        <div className="rounded-lg border border-[#d29922]/30 bg-[rgba(210,153,34,0.05)] p-4 mb-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="size-4 text-[#d29922] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-[#d29922]">
                Catalog registry is not configured.
              </p>
              <p className="mt-1 text-xs text-[#8b949e]">
                Set <code className="font-mono">UPSTASH_REDIS_REST_URL</code>{" "}
                and <code className="font-mono">UPSTASH_REDIS_REST_TOKEN</code>{" "}
                to enable the public catalog. You can still look up any token
                by its full mint address above.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && configured !== false && (
        <div className="rounded-lg border border-[#f85149]/30 bg-[rgba(248,81,73,0.05)] p-4 mb-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="size-4 text-[#f85149] mt-0.5 shrink-0" />
            <p className="text-sm text-[#f85149]">{error}</p>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-5 text-[#8b949e] animate-spin" />
          <span className="ml-2 text-sm text-[#8b949e]">Loading catalog...</span>
        </div>
      )}

      {!isLoading && entries && filtered.length > 0 && (
        <>
          <p className="text-xs text-[#8b949e] mb-3">
            {filtered.length} {filtered.length === 1 ? "token" : "tokens"}
            {query && ` matching "${query}"`}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((entry) => (
              <TokenCard key={entry.mint} entry={entry} />
            ))}
          </div>
        </>
      )}

      {!isLoading && entries && entries.length === 0 && configured !== false && (
        <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-12 text-center">
          <Search className="size-8 text-[#8b949e] mx-auto mb-3" />
          <p className="text-sm text-[#8b949e]">
            No tokens registered yet.
          </p>
          <p className="text-xs text-[#484f58] mt-1">
            Create a token and it will appear here automatically.
          </p>
        </div>
      )}

      {!isLoading && entries && entries.length > 0 && filtered.length === 0 && (
        <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-8 text-center">
          <p className="text-sm text-[#8b949e]">
            No tokens match &ldquo;{query}&rdquo;.
          </p>
          {isValidPublicKey(query.trim()) && (
            <button
              onClick={handleDirectLookup}
              className="mt-2 text-xs text-[#58a6ff] hover:underline"
            >
              Look up this mint address directly →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
