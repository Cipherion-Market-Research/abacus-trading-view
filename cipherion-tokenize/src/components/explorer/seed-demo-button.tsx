"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Sparkles, Loader2, CheckCircle2, XCircle } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { useSeedDemo, type SeedItemStatus } from "@/hooks/use-seed-demo";
import { useKycStatus } from "@/hooks/use-kyc-status";
import { isDevnet } from "@/lib/solana/connection";
import { DEMO_SEEDS } from "@/lib/demo-seeds";

interface SeedDemoButtonProps {
  onComplete?: () => void;
}

export function SeedDemoButton({ onComplete }: SeedDemoButtonProps) {
  const { connected } = useWallet();
  const { status } = useKycStatus();
  const { seed, items, isRunning } = useSeedDemo();
  const [open, setOpen] = useState(false);

  const eligible = isDevnet() && connected && status === "approved";
  if (!eligible) return null;

  const allDone = items.length > 0 && items.every((i) => i.status === "done");

  const handleStart = async () => {
    await seed();
    if (items.every((i) => i.status === "done") || items.some((i) => i.status === "done")) {
      onComplete?.();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 text-[12px] font-medium text-[#a371f7] hover:text-[#b07fff] transition-colors"
      >
        <Sparkles className="size-3.5" />
        Seed 5 demo tokens
      </button>

      <Dialog.Root open={open} onOpenChange={(o) => !isRunning && setOpen(o)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[#30363d] bg-[#0a0e13] shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          >
            <div className="px-6 py-5 border-b border-[#21262d]">
              <Dialog.Title className="flex items-center gap-2 text-[18px] font-semibold text-[#f0f6fc]">
                <Sparkles className="size-4 text-[#a371f7]" />
                Seed demo data
              </Dialog.Title>
              <p className="mt-1 text-[12px] text-[#8b949e]">
                Creates 5 realistic sample tokens on Solana Devnet, registered
                in the Atlas catalog. Each requires a wallet signature.
              </p>
            </div>

            <div className="px-6 py-5 max-h-[50vh] overflow-y-auto">
              {items.length === 0 ? (
                <div className="space-y-2">
                  {DEMO_SEEDS.map((s) => (
                    <div
                      key={s.symbol}
                      className="flex items-center justify-between rounded-md border border-[#21262d] bg-[#0d1117] px-3 py-2.5"
                    >
                      <div>
                        <div className="text-[13px] font-medium text-[#f0f6fc]">
                          {s.params.name}
                        </div>
                        <div className="font-mono text-[10px] text-[#8b949e]">
                          {s.symbol} · {s.params.assetType}
                        </div>
                      </div>
                      <div className="font-mono text-[10px] text-[#6e7681] uppercase tracking-wider">
                        Pending
                      </div>
                    </div>
                  ))}
                  <p className="mt-3 text-[11px] text-[#6e7681] font-mono leading-relaxed">
                    Estimated cost: ~0.04 SOL across 5 mints. You will see 5
                    wallet sign prompts in sequence. The dialog stays open
                    until all complete or one fails.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.symbol}
                      className="flex items-center justify-between rounded-md border border-[#21262d] bg-[#0d1117] px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium text-[#f0f6fc] truncate">
                          {item.name}
                        </div>
                        <div className="font-mono text-[10px] text-[#8b949e]">
                          {item.symbol}
                          {item.error && (
                            <span className="ml-2 text-[#f85149]">
                              · {item.error}
                            </span>
                          )}
                        </div>
                      </div>
                      <StatusIcon status={item.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[#21262d] flex items-center justify-end gap-3">
              {!isRunning && !allDone && (
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-[12px] text-[#8b949e] hover:text-[#f0f6fc] transition-colors px-3 py-2"
                >
                  Cancel
                </button>
              )}
              {!allDone && items.length === 0 && (
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={isRunning}
                  className="rounded-full bg-[#238636] text-white hover:bg-[#2ea043] disabled:bg-[#21262d] disabled:text-[#6e7681] text-[13px] font-medium px-5 py-2.5 transition-colors inline-flex items-center gap-2"
                >
                  {isRunning ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  Start seeding
                </button>
              )}
              {allDone && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onComplete?.();
                  }}
                  className="rounded-full bg-[#f0f6fc] text-[#0a0e13] hover:bg-white text-[13px] font-medium px-5 py-2.5 transition-colors"
                >
                  Done
                </button>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function StatusIcon({ status }: { status: SeedItemStatus }) {
  if (status === "in_progress") {
    return <Loader2 className="size-4 text-[#d29922] animate-spin" />;
  }
  if (status === "done") {
    return <CheckCircle2 className="size-4 text-[#3fb950]" />;
  }
  if (status === "failed") {
    return <XCircle className="size-4 text-[#f85149]" />;
  }
  return (
    <span className="font-mono text-[10px] text-[#6e7681] uppercase tracking-wider">
      Pending
    </span>
  );
}

