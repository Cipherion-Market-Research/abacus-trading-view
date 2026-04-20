"use client";

import { useState, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, ArrowDown, Download, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { forceBurn } from "@/lib/solana/compliance-service";
import { getTokenMetadata } from "@/lib/solana/metadata-service";
import { formatTokenAmount } from "@/lib/utils/format";
import type { PortfolioToken } from "@/hooks/use-portfolio";

interface RedemptionDialogProps {
  token: PortfolioToken;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface RedemptionReceipt {
  type: "redemption_receipt";
  version: "1.0";
  token: { mint: string; name: string; symbol: string; decimals: number };
  redemption: {
    amount: string;
    navPerToken: number;
    usdcEquivalent: string;
    burnSignature: string;
  };
  holder: string;
  timestamp: string;
  chain: "solana-devnet" | "solana-mainnet";
}

const NAV_KEYS = ["nav_per_token", "nav", "net_asset_value", "nav_per_share"];

export function RedemptionDialog({
  token,
  open,
  onOpenChange,
  onSuccess,
}: RedemptionDialogProps) {
  const { publicKey } = useWallet();
  const { signAndSend } = useSendTransaction();
  const [amount, setAmount] = useState("");
  const [navPerToken, setNavPerToken] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [navLoading, setNavLoading] = useState(false);
  const [receipt, setReceipt] = useState<RedemptionReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch NAV from on-chain metadata when dialog opens
  useEffect(() => {
    if (!open) {
      setAmount("");
      setReceipt(null);
      setError(null);
      return;
    }
    let cancelled = false;
    async function fetchNav() {
      setNavLoading(true);
      try {
        const metadata = await getTokenMetadata(token.mint);
        for (const key of NAV_KEYS) {
          const field = metadata.additionalFields.find(
            (f) => f.key.toLowerCase() === key
          );
          if (field) {
            const parsed = parseFloat(field.value.replace(/[$,\s]/g, ""));
            if (!isNaN(parsed) && parsed > 0 && !cancelled) {
              setNavPerToken(parsed);
              return;
            }
          }
        }
        if (!cancelled) setNavPerToken(null);
      } catch {
        if (!cancelled) setNavPerToken(null);
      } finally {
        if (!cancelled) setNavLoading(false);
      }
    }
    fetchNav();
    return () => { cancelled = true; };
  }, [open, token.mint]);

  const parsedAmount = parseFloat(amount);
  const isValidAmount =
    !isNaN(parsedAmount) &&
    parsedAmount > 0 &&
    BigInt(Math.round(parsedAmount * Math.pow(10, token.decimals))) <= token.balance;

  const tokenAmount = isValidAmount
    ? BigInt(Math.round(parsedAmount * Math.pow(10, token.decimals)))
    : 0n;

  const usdcValue = isValidAmount && navPerToken
    ? parsedAmount * navPerToken
    : 0;

  const maxTokens = Number(token.balance) / Math.pow(10, token.decimals);

  async function handleRedeem() {
    if (!publicKey || !isValidAmount || !signAndSend) return;
    setLoading(true);
    setError(null);

    try {
      // Execute burn via Permanent Delegate authority (connected wallet)
      const signature = await forceBurn(
        token.mint,
        publicKey,
        tokenAmount,
        token.decimals,
        publicKey, // authority = connected wallet (issuer/delegate)
        signAndSend
      );

      const receiptData: RedemptionReceipt = {
        type: "redemption_receipt",
        version: "1.0",
        token: {
          mint: token.mint.toBase58(),
          name: token.name,
          symbol: token.symbol,
          decimals: token.decimals,
        },
        redemption: {
          amount: parsedAmount.toString(),
          navPerToken: navPerToken ?? 0,
          usdcEquivalent: usdcValue.toFixed(2),
          burnSignature: signature,
        },
        holder: publicKey.toBase58(),
        timestamp: new Date().toISOString(),
        chain: "solana-devnet",
      };

      setReceipt(receiptData);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Redemption failed");
    } finally {
      setLoading(false);
    }
  }

  function downloadReceipt() {
    if (!receipt) return;
    const blob = new Blob([JSON.stringify(receipt, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `redemption-receipt-${receipt.redemption.burnSignature.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[#30363d] bg-[#161b22] p-6 shadow-2xl">
          <Dialog.Title className="text-lg font-semibold text-[#f0f6fc] mb-1">
            Redeem {token.symbol}
          </Dialog.Title>
          <Dialog.Description className="text-xs text-[#8b949e] mb-5">
            Burn tokens at NAV and receive USDC equivalent.
          </Dialog.Description>

          <Dialog.Close asChild>
            <button className="absolute top-4 right-4 text-[#8b949e] hover:text-[#f0f6fc]">
              <X className="size-4" />
            </button>
          </Dialog.Close>

          {receipt ? (
            /* ─── Success state ─── */
            <div className="space-y-4">
              <div className="flex flex-col items-center text-center py-4">
                <CheckCircle2 className="size-10 text-[#3fb950] mb-3" />
                <p className="text-sm font-semibold text-[#f0f6fc] mb-1">
                  Redemption complete
                </p>
                <p className="text-xs text-[#8b949e]">
                  {receipt.redemption.amount} {token.symbol} burned at $
                  {receipt.redemption.navPerToken}/token
                </p>
              </div>

              <div className="rounded-lg border border-[#238636]/30 bg-[rgba(35,134,54,0.05)] p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[#8b949e]">USDC receivable</span>
                  <span className="font-mono text-sm font-semibold text-[#3fb950]">
                    ${receipt.redemption.usdcEquivalent}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#8b949e]">Burn signature</span>
                  <span className="font-mono text-[10px] text-[#58a6ff]">
                    {receipt.redemption.burnSignature.slice(0, 12)}...
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-[#6e7681] text-center">
                Simulated USDC settlement. Production: atomic burn + USDC transfer in a single transaction.
              </p>

              <Button
                onClick={downloadReceipt}
                className="w-full gap-2 bg-[#21262d] border border-[#30363d] text-[#f0f6fc] hover:bg-[#30363d]"
              >
                <Download className="size-3.5" />
                Download signed receipt
              </Button>
            </div>
          ) : (
            /* ─── Input state ─── */
            <div className="space-y-4">
              {/* Amount input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] uppercase tracking-wider text-[#8b949e]">
                    Amount to redeem
                  </label>
                  <button
                    type="button"
                    onClick={() => setAmount(maxTokens.toString())}
                    className="text-[10px] font-mono text-[#58a6ff] hover:underline"
                  >
                    Max: {formatTokenAmount(token.balance, token.decimals)}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="any"
                    min="0"
                    className="w-full rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2.5 pr-16 font-mono text-sm text-[#f0f6fc] placeholder:text-[#484f58] focus:border-[#238636] focus:outline-none focus:ring-1 focus:ring-[#238636]/30"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-[#8b949e]">
                    {token.symbol}
                  </span>
                </div>
              </div>

              {/* NAV display */}
              {navLoading ? (
                <div className="flex items-center gap-2 text-xs text-[#8b949e]">
                  <Loader2 className="size-3 animate-spin" />
                  Fetching NAV...
                </div>
              ) : navPerToken ? (
                <div className="rounded-md border border-[#30363d] bg-[#0d1117] p-3">
                  <div className="flex items-center justify-between text-xs text-[#8b949e] mb-2">
                    <span>NAV per token</span>
                    <span className="font-mono text-[#f0f6fc]">
                      ${navPerToken.toFixed(2)}
                    </span>
                  </div>

                  {isValidAmount && (
                    <>
                      <div className="flex justify-center my-2">
                        <ArrowDown className="size-3.5 text-[#6e7681]" />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#8b949e]">You receive</span>
                        <span className="font-mono text-sm font-semibold text-[#3fb950]">
                          ${usdcValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                        </span>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-[#d29922]">
                  No NAV metadata found. Redemption value cannot be calculated — the issuer
                  must set <code className="font-mono">nav_per_token</code> in on-chain metadata.
                </p>
              )}

              {error && (
                <p className="text-xs text-[#f85149]">{error}</p>
              )}

              <Button
                onClick={handleRedeem}
                disabled={!isValidAmount || !navPerToken || loading}
                className="w-full gap-2 bg-[#238636] text-white hover:bg-[#2ea043] disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Burning tokens...
                  </>
                ) : (
                  `Redeem ${isValidAmount ? parsedAmount : 0} ${token.symbol}`
                )}
              </Button>

              <p className="text-[10px] text-[#6e7681] text-center">
                Demo: burns tokens on-chain via Permanent Delegate. USDC settlement is simulated.
              </p>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
