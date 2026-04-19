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

    let createdCount = 0;

    for (let i = 0; i < DEMO_SEEDS.length; i++) {
      const seed = DEMO_SEEDS[i];
      setItems((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: "in_progress" } : item
        )
      );

      try {
        const result = await create(seed.params);
        if (!result) {
          // create() returned null — wallet rejection or other error already toasted
          setItems((prev) =>
            prev.map((item, idx) =>
              idx === i
                ? { ...item, status: "failed", error: "Creation failed" }
                : item
            )
          );
          break; // Stop the seed run on first failure (likely wallet cancel)
        }

        // Register in catalog (non-blocking)
        const imageField = seed.params.metadata.find((f) => f.key === "image");
        await register({
          mint: result.mint.toBase58(),
          creator: publicKey.toBase58(),
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

    if (createdCount === DEMO_SEEDS.length) {
      toastSuccess(`Seeded ${createdCount} demo tokens`, {
        description: "All tokens registered in the Atlas catalog.",
      });
    } else if (createdCount > 0) {
      toastError(`Seeded ${createdCount} of ${DEMO_SEEDS.length}`, {
        description: "Run interrupted — see panel for details.",
      });
    }
  }, [create, register, publicKey]);

  return { seed, reset, items, isRunning };
}
