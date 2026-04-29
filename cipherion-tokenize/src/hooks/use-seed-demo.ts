"use client";

import { useState, useCallback } from "react";
import { useTokenCreate } from "@/hooks/use-token-create";
import { useRegisterMint } from "@/hooks/use-register-mint";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { DEMO_SEEDS } from "@/lib/demo-seeds";
import { toastSuccess, toastError } from "@/hooks/use-toast";

export type SeedItemStatus = "pending" | "in_progress" | "done" | "skipped" | "failed";

export interface SeedItem {
  symbol: string;
  name: string;
  status: SeedItemStatus;
  mint?: string;
  error?: string;
}

export function useSeedDemo() {
  const { create } = useTokenCreate();
  const { register } = useRegisterMint();
  const { publicKey } = useSendTransaction();
  const [isRunning, setIsRunning] = useState(false);
  const [items, setItems] = useState<SeedItem[]>([]);

  const reset = useCallback(() => {
    setItems([]);
  }, []);

  const seed = useCallback(async () => {
    if (!publicKey) {
      toastError("Connect your wallet first");
      return;
    }

    setIsRunning(true);
    const initial: SeedItem[] = DEMO_SEEDS.map((s) => ({
      symbol: s.symbol,
      name: s.params.name,
      status: "pending",
    }));
    setItems(initial);

    // Fetch existing catalog to dedupe by name+creator
    let existingNames: Set<string> = new Set();
    try {
      const res = await fetch(`/api/mints/list?creator=${publicKey.toBase58()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.entries) {
          existingNames = new Set(
            json.entries.map((e: { name: string }) => e.name)
          );
        }
      }
    } catch {
      // If catalog is unreachable, proceed without dedupe
    }

    let createdCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < DEMO_SEEDS.length; i++) {
      // Throttle between creations to stay within RPC per-second limits
      if (i > 0) {
        await new Promise((r) => setTimeout(r, 2000));
      }

      const seed = DEMO_SEEDS[i];

      // Skip if a token with this name already exists in the catalog
      if (existingNames.has(seed.params.name)) {
        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: "skipped" } : item
          )
        );
        skippedCount++;
        continue;
      }

      setItems((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: "in_progress" } : item
        )
      );

      try {
        const result = await create(seed.params);
        if (!result) {
          setItems((prev) =>
            prev.map((item, idx) =>
              idx === i
                ? { ...item, status: "failed", error: "Creation failed" }
                : item
            )
          );
          break;
        }

        // Register in catalog
        const imageField = seed.params.metadata.find((f) => f.key === "image");
        await register({
          mint: result.mint.toBase58(),
          assetType: seed.params.assetType,
          imageUri: imageField?.value ?? "",
          description: seed.params.description ?? "",
        });

        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? { ...item, status: "done", mint: result.mint.toBase58() }
              : item
          )
        );
        createdCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: "failed", error: msg } : item
          )
        );
        break;
      }
    }

    setIsRunning(false);

    const total = createdCount + skippedCount;
    if (total === DEMO_SEEDS.length) {
      if (skippedCount === DEMO_SEEDS.length) {
        toastSuccess("Demo tokens already seeded", {
          description: "All 5 tokens exist in the catalog.",
        });
      } else {
        toastSuccess(`Seeded ${createdCount} demo tokens`, {
          description: skippedCount > 0
            ? `${skippedCount} already existed — skipped.`
            : "All tokens registered in the Atlas catalog.",
        });
      }
    } else if (createdCount > 0) {
      toastError(`Seeded ${createdCount} of ${DEMO_SEEDS.length}`, {
        description: "Run interrupted — see panel for details.",
      });
    }
  }, [create, register, publicKey]);

  return { seed, reset, items, isRunning };
}
