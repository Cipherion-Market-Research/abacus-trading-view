"use client";

import { useState, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { Shield, Snowflake, Sun, Flame, Loader2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddressDisplay } from "@/components/shared/address-display";
import { ComplianceSimulator } from "@/components/compliance/compliance-simulator";
import { freezeAccount, thawAccount, forceBurn, pauseToken, unpauseToken } from "@/lib/solana/compliance-service";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { toastSuccess, toastError } from "@/hooks/use-toast";
import { useNetwork } from "@/hooks/use-network";
import { isValidPublicKey } from "@/lib/utils/validation";
import { formatTokenAmount } from "@/lib/utils/format";
import type { TokenInfo, HolderInfo } from "@/types/token";

interface CompliancePanelProps {
  token: TokenInfo;
  holders: HolderInfo[];
  onSuccess?: () => void;
}

type ConfirmAction =
  | { type: "freeze"; holder: HolderInfo }
  | { type: "thaw"; holder: HolderInfo }
  | { type: "burn"; holder: HolderInfo };

export function CompliancePanel({
  token,
  holders,
  onSuccess,
}: CompliancePanelProps) {
  const { signAndSend, publicKey } = useSendTransaction();
  const { explorerTxUrl } = useNetwork();
  const [isLoading, setIsLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [burnAmount, setBurnAmount] = useState("");
  const [confirmSymbol, setConfirmSymbol] = useState("");

  const handleFreeze = useCallback(
    async (holder: HolderInfo) => {
      if (!publicKey) return;
      setIsLoading(true);
      try {
        const sig = await freezeAccount(
          token.mint,
          holder.owner,
          publicKey,
          signAndSend
        );
        toastSuccess(`Account frozen`, {
          description: `${holder.owner.toBase58().slice(0, 8)}... can no longer send or receive.`,
          action: { label: "View TX", href: explorerTxUrl(sig) },
        });
        setConfirmAction(null);
        onSuccess?.();
      } catch (err) {
        toastError(err instanceof Error ? err.message : "Freeze failed");
      } finally {
        setIsLoading(false);
      }
    },
    [publicKey, signAndSend, token.mint, explorerTxUrl, onSuccess]
  );

  const handleThaw = useCallback(
    async (holder: HolderInfo) => {
      if (!publicKey) return;
      setIsLoading(true);
      try {
        const sig = await thawAccount(
          token.mint,
          holder.owner,
          publicKey,
          signAndSend
        );
        toastSuccess(`Account thawed`, {
          description: `${holder.owner.toBase58().slice(0, 8)}... can now send and receive.`,
          action: { label: "View TX", href: explorerTxUrl(sig) },
        });
        setConfirmAction(null);
        onSuccess?.();
      } catch (err) {
        toastError(err instanceof Error ? err.message : "Thaw failed");
      } finally {
        setIsLoading(false);
      }
    },
    [publicKey, signAndSend, token.mint, explorerTxUrl, onSuccess]
  );

  const handleForceBurn = useCallback(
    async (holder: HolderInfo) => {
      if (!publicKey) return;
      const numAmount = parseFloat(burnAmount);
      if (isNaN(numAmount) || numAmount <= 0) return;
      const rawAmount = BigInt(Math.floor(numAmount * 10 ** token.decimals));

      setIsLoading(true);
      try {
        const sig = await forceBurn(
          token.mint,
          holder.owner,
          rawAmount,
          token.decimals,
          token.extensions.permanentDelegate!,
          signAndSend
        );
        toastSuccess(`Tokens burned`, {
          description: `${burnAmount} ${token.symbol} burned from ${holder.owner.toBase58().slice(0, 8)}...`,
          action: { label: "View TX", href: explorerTxUrl(sig) },
        });
        setConfirmAction(null);
        setBurnAmount("");
        setConfirmSymbol("");
        onSuccess?.();
      } catch (err) {
        toastError(err instanceof Error ? err.message : "Force burn failed");
      } finally {
        setIsLoading(false);
      }
    },
    [publicKey, signAndSend, token, burnAmount, explorerTxUrl, onSuccess]
  );

  const isAuthority =
    publicKey &&
    (token.freezeAuthority?.equals(publicKey) ||
      token.mintAuthority?.equals(publicKey));

  const isPermanentDelegate =
    publicKey &&
    token.extensions.permanentDelegate != null &&
    token.extensions.permanentDelegate.equals(publicKey);

  if (!isAuthority) {
    return (
      <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-8 text-center">
        <Shield className="size-8 text-[#8b949e] mx-auto mb-2" />
        <p className="text-sm text-[#8b949e]">
          Only the token authority can perform compliance actions.
        </p>
      </div>
    );
  }

  const handlePause = useCallback(async () => {
    if (!publicKey) return;
    setIsLoading(true);
    try {
      const sig = await pauseToken(token.mint, publicKey, signAndSend);
      toastSuccess("Token paused", {
        description: "All transfers, minting, and burning are halted.",
        action: { label: "View TX", href: explorerTxUrl(sig) },
      });
      onSuccess?.();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Pause failed");
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, signAndSend, token.mint, explorerTxUrl, onSuccess]);

  const handleUnpause = useCallback(async () => {
    if (!publicKey) return;
    setIsLoading(true);
    try {
      const sig = await unpauseToken(token.mint, publicKey, signAndSend);
      toastSuccess("Token resumed", {
        description: "Normal operations restored.",
        action: { label: "View TX", href: explorerTxUrl(sig) },
      });
      onSuccess?.();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Resume failed");
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, signAndSend, token.mint, explorerTxUrl, onSuccess]);

  return (
    <div className="space-y-4">
      {/* Pre-trade compliance simulator */}
      <ComplianceSimulator token={token} holders={holders} />

      {/* Token-level controls */}
      <div>
        <p className="text-[11px] uppercase tracking-wider text-[#8b949e] mb-3">
          Token Controls
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePause}
            disabled={isLoading}
            className="gap-1.5 border-[#30363d] bg-[#0d1117] text-[#d29922] hover:text-[#d29922] hover:bg-[rgba(210,153,34,0.1)]"
          >
            {isLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Pause className="size-3.5" />}
            Pause Token
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleUnpause}
            disabled={isLoading}
            className="gap-1.5 border-[#30363d] bg-[#0d1117] text-[#3fb950] hover:text-[#3fb950] hover:bg-[rgba(63,185,80,0.1)]"
          >
            {isLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
            Resume Token
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-[#8b949e]">
          Pause halts all transfers, minting, and burning. Requires the Pausable extension.
        </p>
      </div>

      {/* Holder actions */}
      <div>
        <p className="text-[11px] uppercase tracking-wider text-[#8b949e] mb-3">
          Account Actions
        </p>
        {holders.length === 0 ? (
          <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-6 text-center">
            <p className="text-xs text-[#8b949e]">No holders to manage.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {holders.map((holder) => (
              <div
                key={holder.address.toBase58()}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-[#30363d] bg-[#0d1117] p-3"
              >
                <div className="min-w-0">
                  <AddressDisplay
                    address={holder.owner.toBase58()}
                    showExplorer
                    className="text-[#f0f6fc]"
                  />
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="font-mono text-xs text-[#8b949e]">
                      {formatTokenAmount(holder.balance, token.decimals)}{" "}
                      {token.symbol}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                        holder.isFrozen
                          ? "bg-[rgba(210,153,34,0.15)] text-[#d29922]"
                          : "bg-[rgba(63,185,80,0.15)] text-[#3fb950]"
                      }`}
                    >
                      {holder.isFrozen ? "Frozen" : "Active"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 sm:shrink-0 -ml-1.5 sm:ml-0">
                  {holder.isFrozen ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setConfirmAction({ type: "thaw", holder })
                      }
                      className="gap-1 text-xs text-[#3fb950] hover:text-[#3fb950] hover:bg-[rgba(63,185,80,0.1)]"
                    >
                      <Sun className="size-3" />
                      Thaw
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setConfirmAction({ type: "freeze", holder })
                      }
                      className="gap-1 text-xs text-[#d29922] hover:text-[#d29922] hover:bg-[rgba(210,153,34,0.1)]"
                    >
                      <Snowflake className="size-3" />
                      Freeze
                    </Button>
                  )}
                  {isPermanentDelegate && holder.balance > 0n && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setConfirmAction({ type: "burn", holder })
                      }
                      className="gap-1 text-xs text-[#f85149] hover:text-[#f85149] hover:bg-[rgba(248,81,73,0.1)]"
                    >
                      <Flame className="size-3" />
                      Burn
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation dialog */}
      <Dialog
        open={!!confirmAction}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmAction(null);
            setBurnAmount("");
            setConfirmSymbol("");
          }
        }}
      >
        <DialogContent className="border-[#30363d] bg-[#161b22] text-[#f0f6fc] max-w-md">
          {confirmAction?.type === "freeze" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-[#d29922]">
                  <Snowflake className="size-4" />
                  Freeze Account
                </DialogTitle>
                <DialogDescription className="text-[#8b949e]">
                  This will prevent{" "}
                  <span className="font-mono text-[#f0f6fc]">
                    {confirmAction.holder.owner.toBase58().slice(0, 8)}...
                  </span>{" "}
                  from sending or receiving {token.symbol}. You can thaw the
                  account later to restore access.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmAction(null)}
                  className="border-[#30363d] bg-[#0d1117] text-[#8b949e]"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleFreeze(confirmAction.holder)}
                  disabled={isLoading}
                  className="gap-1 bg-[#d29922] text-black hover:bg-[#d29922]/90"
                >
                  {isLoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Snowflake className="size-3.5" />
                  )}
                  Freeze Account
                </Button>
              </DialogFooter>
            </>
          )}

          {confirmAction?.type === "thaw" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-[#3fb950]">
                  <Sun className="size-4" />
                  Thaw Account
                </DialogTitle>
                <DialogDescription className="text-[#8b949e]">
                  This will allow{" "}
                  <span className="font-mono text-[#f0f6fc]">
                    {confirmAction.holder.owner.toBase58().slice(0, 8)}...
                  </span>{" "}
                  to send and receive {token.symbol} again.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmAction(null)}
                  className="border-[#30363d] bg-[#0d1117] text-[#8b949e]"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleThaw(confirmAction.holder)}
                  disabled={isLoading}
                  className="gap-1 bg-[#238636] text-white hover:bg-[#2ea043]"
                >
                  {isLoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sun className="size-3.5" />
                  )}
                  Thaw Account
                </Button>
              </DialogFooter>
            </>
          )}

          {confirmAction?.type === "burn" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-[#f85149]">
                  <Flame className="size-4" />
                  Force Burn Tokens
                </DialogTitle>
                <DialogDescription className="text-[#8b949e]">
                  This will permanently destroy tokens from{" "}
                  <span className="font-mono text-[#f0f6fc]">
                    {confirmAction.holder.owner.toBase58().slice(0, 8)}...
                  </span>
                  . This cannot be undone. Available balance:{" "}
                  <span className="font-mono text-[#f0f6fc]">
                    {formatTokenAmount(
                      confirmAction.holder.balance,
                      token.decimals
                    )}{" "}
                    {token.symbol}
                  </span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#8b949e] mb-1 block">
                    Amount to burn
                  </label>
                  <Input
                    type="text"
                    value={burnAmount}
                    onChange={(e) => setBurnAmount(e.target.value)}
                    placeholder="0.00"
                    className="border-[#30363d] bg-[#0d1117] text-[#f0f6fc] font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[#8b949e] mb-1 block">
                    Type "{token.symbol}" to confirm
                  </label>
                  <Input
                    value={confirmSymbol}
                    onChange={(e) => setConfirmSymbol(e.target.value)}
                    placeholder={token.symbol}
                    className="border-[#30363d] bg-[#0d1117] text-[#f0f6fc] font-mono"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setConfirmAction(null);
                    setBurnAmount("");
                    setConfirmSymbol("");
                  }}
                  className="border-[#30363d] bg-[#0d1117] text-[#8b949e]"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleForceBurn(confirmAction.holder)}
                  disabled={
                    isLoading ||
                    confirmSymbol !== token.symbol ||
                    !burnAmount ||
                    parseFloat(burnAmount) <= 0
                  }
                  className="gap-1 bg-[#f85149] text-white hover:bg-[#f85149]/90"
                >
                  {isLoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Flame className="size-3.5" />
                  )}
                  Burn Tokens
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
