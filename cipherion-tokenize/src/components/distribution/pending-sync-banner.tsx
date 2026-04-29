"use client";

import { useState } from "react";
import { AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  getPendingSyncRecords,
  postDistributionToServer,
  markSyncComplete,
  markSyncPending,
} from "@/lib/distributions";
import { buildSignatureMessage } from "@/lib/api/auth-message";

interface PendingSyncBannerProps {
  mintAddress: string;
  count: number;
  onSynced: () => void;
}

export function PendingSyncBanner({ mintAddress, count, onSynced }: PendingSyncBannerProps) {
  const { publicKey, signMessage } = useWallet();
  const [retrying, setRetrying] = useState(false);

  if (count === 0) return null;

  const handleRetry = async () => {
    if (!publicKey || !signMessage) return;
    setRetrying(true);

    try {
      const pending = getPendingSyncRecords(mintAddress);
      let synced = 0;

      for (const record of pending) {
        const nonce = crypto.randomUUID();
        const timestamp = Date.now();
        const msg = buildSignatureMessage("distribution", mintAddress, nonce, timestamp);
        const sigBytes = await signMessage(new TextEncoder().encode(msg));
        const signature = Buffer.from(sigBytes).toString("base64");

        const result = await postDistributionToServer(record, {
          wallet: publicKey.toBase58(),
          nonce,
          timestamp,
          signature,
        });

        if (result.ok) {
          markSyncComplete(mintAddress, record.id);
          synced++;
        } else {
          markSyncPending(mintAddress, record.id);
        }
      }

      if (synced > 0) onSynced();
    } catch {
      // Wallet rejected or network error — banner stays
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="rounded-lg border border-[rgba(210,153,34,0.4)] bg-[rgba(210,153,34,0.08)] px-4 py-3 flex items-center gap-3">
      <AlertTriangle className="size-4 text-[#d29922] shrink-0" />
      <span className="text-[13px] text-[#d29922] flex-1">
        {count} distribution{count !== 1 ? "s" : ""} pending server sync.
        {!publicKey && " Connect wallet to retry."}
      </span>
      {publicKey && signMessage && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRetry}
          disabled={retrying}
          className="gap-1.5 text-[11px] text-[#d29922] hover:text-[#f0f6fc] hover:bg-[rgba(210,153,34,0.15)] h-7 px-2"
        >
          {retrying ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
          Retry
        </Button>
      )}
    </div>
  );
}
