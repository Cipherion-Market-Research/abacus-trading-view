"use client";

import { useMemo, useState, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { Loader2, Sparkles, ArrowRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  computeAllocations,
  mintToHolder,
} from "@/lib/solana/distribution-service";
import {
  newDistributionId,
  saveDistribution,
  type DistributionRecipient,
  type DistributionRecord,
  type RecipientStatus,
} from "@/lib/distributions";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { useNetwork } from "@/hooks/use-network";
import { toastSuccess, toastError } from "@/hooks/use-toast";
import { formatTokenAmount } from "@/lib/utils/format";
import type { TokenInfo, HolderInfo } from "@/types/token";

interface DistributionFormProps {
  token: TokenInfo;
  holders: HolderInfo[];
  onClose: () => void;
  onComplete: () => void;
}

function defaultMemo(): string {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  const yy = now.getFullYear().toString().slice(-2);
  return `Q${q}-${yy} coupon distribution`;
}

export function DistributionForm({
  token,
  holders,
  onClose,
  onComplete,
}: DistributionFormProps) {
  const { signAndSend, publicKey } = useSendTransaction();
  const { explorerTxUrl } = useNetwork();

  const [amountInput, setAmountInput] = useState("");
  const [memo, setMemo] = useState(defaultMemo());
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<DistributionRecipient[] | null>(null);

  const amountRaw = useMemo(() => {
    const n = parseFloat(amountInput);
    if (isNaN(n) || n <= 0) return 0n;
    return BigInt(Math.floor(n * 10 ** token.decimals));
  }, [amountInput, token.decimals]);

  const result = useMemo(() => {
    if (!publicKey || amountRaw === 0n) return null;
    return computeAllocations({
      holders,
      totalAmount: amountRaw,
      treasuryOwner: publicKey,
    });
  }, [holders, amountRaw, publicKey]);

  const canRun = !!result && result.eligibleCount > 0 && amountRaw > 0n;

  const run = useCallback(async () => {
    if (!result || !publicKey) return;
    setRunning(true);
    const eligibleAllocations = result.allocations.filter(
      (a) => a.amount > 0n
    );
    const initialProgress: DistributionRecipient[] = eligibleAllocations.map(
      (a) => ({
        ownerAddress: a.ownerAddress,
        amount: a.amount.toString(),
        status: "pending",
      })
    );
    setProgress(initialProgress);

    let totalDone = 0;
    let totalFailed = 0;
    const finalRecipients: DistributionRecipient[] = [...initialProgress];

    for (let i = 0; i < eligibleAllocations.length; i++) {
      const a = eligibleAllocations[i];
      try {
        const sig = await mintToHolder(
          token.mint,
          new PublicKey(a.ownerAddress),
          a.amount,
          publicKey,
          signAndSend
        );
        finalRecipients[i] = {
          ...finalRecipients[i],
          status: "done",
          signature: sig,
        };
        totalDone++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown";
        finalRecipients[i] = {
          ...finalRecipients[i],
          status: "failed",
          error: msg,
        };
        totalFailed++;
        // If wallet rejection, abort the rest of the run
        if (msg.includes("rejected") || msg.includes("WALLET_REJECTED")) {
          for (let j = i + 1; j < finalRecipients.length; j++) {
            finalRecipients[j] = {
              ...finalRecipients[j],
              status: "skipped",
            };
          }
          setProgress([...finalRecipients]);
          break;
        }
      }
      setProgress([...finalRecipients]);
    }

    const status: DistributionRecord["status"] =
      totalFailed === 0
        ? "complete"
        : totalDone === 0
          ? "failed"
          : "partial";

    const record: DistributionRecord = {
      id: newDistributionId(),
      mintAddress: token.mint.toBase58(),
      timestamp: Date.now(),
      totalAmount: amountRaw.toString(),
      totalAllocated: result.totalAllocated.toString(),
      memo,
      recipients: finalRecipients,
      status,
    };
    saveDistribution(record);

    setRunning(false);

    if (status === "complete") {
      toastSuccess(`Distribution complete`, {
        description: `${totalDone} holders received their share.`,
      });
      // Show final state briefly, then close
      setTimeout(() => {
        onComplete();
      }, 1500);
    } else if (status === "partial") {
      toastError(`Distribution partial`, {
        description: `${totalDone} succeeded, ${totalFailed} failed/skipped.`,
      });
    } else {
      toastError(`Distribution failed`, {
        description: `0 of ${eligibleAllocations.length} succeeded.`,
      });
    }
  }, [result, publicKey, token.mint, signAndSend, memo, amountRaw, onComplete]);

  // Final progress view
  if (progress) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-[#f0f6fc]">
              {running ? "Running distribution..." : "Distribution result"}
            </h3>
            <p className="text-[12px] text-[#8b949e]">
              {progress.filter((p) => p.status === "done").length} of{" "}
              {progress.length} complete
            </p>
          </div>
          {!running && (
            <Button
              variant="outline"
              size="sm"
              onClick={onComplete}
              className="border-[#30363d] bg-[#161b22] text-[#8b949e]"
            >
              Close
            </Button>
          )}
        </div>
        <div className="rounded-lg border border-[#30363d] bg-[#0d1117] divide-y divide-[#21262d] max-h-[360px] overflow-y-auto">
          {progress.map((r, i) => (
            <div
              key={`${r.ownerAddress}-${i}`}
              className="flex items-center justify-between px-3 py-2.5 gap-3"
            >
              <div className="font-mono text-[11px] text-[#c9d1d9] truncate min-w-0">
                {r.ownerAddress.slice(0, 8)}...{r.ownerAddress.slice(-4)}
              </div>
              <div className="font-mono text-[12px] text-[#f0f6fc] shrink-0">
                + {formatTokenAmount(BigInt(r.amount), token.decimals)}{" "}
                {token.symbol}
              </div>
              <div className="shrink-0 w-20 text-right">
                <RecipientStatus status={r.status} signature={r.signature} explorerTxUrl={explorerTxUrl} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[15px] font-semibold text-[#f0f6fc] mb-1">
          New distribution
        </h3>
        <p className="text-[12px] text-[#8b949e]">
          Atlas mints new tokens directly to each approved holder, pro-rata to
          their current balance. Same mechanic BUIDL and BENJI use.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-[#8b949e] mb-1 block">
            Total amount to distribute ({token.symbol})
          </label>
          <Input
            type="number"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            placeholder="e.g. 1000"
            min={0}
            className="border-[#30363d] bg-[#0d1117] text-[#f0f6fc] font-mono"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-[#8b949e] mb-1 block">
            Memo (recorded on-chain per recipient)
          </label>
          <Input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="e.g. Q3-26 coupon distribution"
            className="border-[#30363d] bg-[#0d1117] text-[#f0f6fc]"
          />
        </div>
      </div>

      {result && amountRaw > 0n && (
        <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] uppercase tracking-wider text-[#8b949e]">
              Allocation preview
            </p>
            <p className="text-[11px] text-[#8b949e]">
              {result.eligibleCount} eligible
              {result.frozenCount > 0 &&
                ` · ${result.frozenCount} frozen (skipped)`}
            </p>
          </div>
          {result.eligibleCount === 0 ? (
            <div className="flex items-start gap-2 text-[12px] text-[#d29922]">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>
                No eligible holders. All holders are either frozen, the
                treasury, or have a zero balance.
              </span>
            </div>
          ) : (
            <>
              <div className="max-h-[240px] overflow-y-auto rounded-md border border-[#21262d] divide-y divide-[#21262d]">
                {result.allocations
                  .filter((a) => a.amount > 0n)
                  .map((a) => (
                    <div
                      key={a.ataAddress}
                      className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 items-center"
                    >
                      <div className="font-mono text-[11px] text-[#c9d1d9] truncate">
                        {a.ownerAddress.slice(0, 8)}...{a.ownerAddress.slice(-4)}
                      </div>
                      <div className="font-mono text-[10px] text-[#8b949e]">
                        {a.pctOfSupply.toFixed(2)}%
                      </div>
                      <div className="font-mono text-[12px] text-[#f0f6fc] tabular-nums">
                        + {formatTokenAmount(a.amount, token.decimals)}
                      </div>
                    </div>
                  ))}
              </div>
              <div className="mt-2 pt-2 border-t border-[#21262d] flex items-center justify-between text-[11px] text-[#8b949e]">
                <span>
                  Total allocated:{" "}
                  <span className="font-mono text-[#c9d1d9]">
                    {formatTokenAmount(result.totalAllocated, token.decimals)}{" "}
                    {token.symbol}
                  </span>
                </span>
                <span>
                  ~${(result.eligibleCount * 0.003).toFixed(3)} on-chain cost
                </span>
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={running}
          className="border-[#30363d] bg-[#161b22] text-[#8b949e]"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={run}
          disabled={!canRun || running}
          className="gap-2 bg-[#238636] text-white hover:bg-[#2ea043] disabled:bg-[#21262d] disabled:text-[#6e7681]"
        >
          {running ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          Run distribution
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function RecipientStatus({
  status,
  signature,
  explorerTxUrl,
}: {
  status: RecipientStatus;
  signature?: string;
  explorerTxUrl: (sig: string) => string;
}) {
  if (status === "done" && signature) {
    return (
      <a
        href={explorerTxUrl(signature)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] font-mono text-[#3fb950] hover:underline"
      >
        ✓ tx
      </a>
    );
  }
  if (status === "pending")
    return <Loader2 className="size-3.5 text-[#d29922] animate-spin inline-block" />;
  if (status === "failed")
    return <span className="text-[10px] font-mono text-[#f85149]">failed</span>;
  if (status === "skipped")
    return <span className="text-[10px] font-mono text-[#6e7681]">skipped</span>;
  return null;
}
