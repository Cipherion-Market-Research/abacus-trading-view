"use client";

import { useState } from "react";
import { Coins, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMintTokens } from "@/hooks/use-compliance";
import { isValidPublicKey } from "@/lib/utils/validation";

interface MintFormProps {
  mintAddress: string;
  decimals: number;
  onSuccess?: () => void;
}

export function MintForm({ mintAddress, decimals, onSuccess }: MintFormProps) {
  const { mint, isLoading } = useMintTokens();
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [mode, setMode] = useState<"treasury" | "distribute">("treasury");

  const handleMint = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    const rawAmount = BigInt(Math.floor(numAmount * 10 ** decimals));
    const dest = mode === "distribute" && recipient.trim() ? recipient.trim() : undefined;

    if (dest && !isValidPublicKey(dest)) return;

    const result = await mint(mintAddress, rawAmount, dest);
    if (result) {
      setAmount("");
      setRecipient("");
      onSuccess?.();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Coins className="size-4 text-[#58a6ff]" />
        <h3 className="text-sm font-semibold text-[#f0f6fc]">
          Mint & Distribute
        </h3>
      </div>

      <div className="flex gap-1 mb-3">
        <button
          onClick={() => setMode("treasury")}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            mode === "treasury"
              ? "bg-[#21262d] text-[#f0f6fc]"
              : "text-[#8b949e] hover:text-[#f0f6fc]"
          }`}
        >
          <Coins className="inline size-3 mr-1" />
          Mint to Treasury
        </button>
        <button
          onClick={() => setMode("distribute")}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            mode === "distribute"
              ? "bg-[#21262d] text-[#f0f6fc]"
              : "text-[#8b949e] hover:text-[#f0f6fc]"
          }`}
        >
          <Send className="inline size-3 mr-1" />
          Distribute
        </button>
      </div>

      <div className="space-y-2">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-[#8b949e] mb-1 block">
            Amount
          </label>
          <Input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`e.g. 1000000`}
            className="border-[#30363d] bg-[#0d1117] text-[#f0f6fc] font-mono placeholder:text-[#484f58]"
          />
        </div>

        {mode === "distribute" && (
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#8b949e] mb-1 block">
              Recipient Wallet
            </label>
            <Input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Recipient wallet address"
              className="border-[#30363d] bg-[#0d1117] text-[#f0f6fc] font-mono text-xs placeholder:text-[#484f58]"
            />
            {recipient && !isValidPublicKey(recipient.trim()) && (
              <p className="mt-1 text-[10px] text-[#f85149]">
                Invalid Solana address
              </p>
            )}
          </div>
        )}

        <Button
          size="sm"
          onClick={handleMint}
          disabled={
            isLoading ||
            !amount ||
            parseFloat(amount) <= 0 ||
            (mode === "distribute" && !!recipient && !isValidPublicKey(recipient.trim()))
          }
          className="gap-1.5 bg-[#238636] text-white hover:bg-[#2ea043]"
        >
          {isLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : mode === "treasury" ? (
            <Coins className="size-3.5" />
          ) : (
            <Send className="size-3.5" />
          )}
          {mode === "treasury" ? "Mint to Treasury" : "Distribute"}
        </Button>
      </div>

      <p className="text-[10px] text-[#8b949e]">
        {mode === "treasury"
          ? "Mints new tokens to your wallet (treasury)."
          : "Mints and sends tokens directly to the recipient. Recipient must be onboarded first."}
      </p>
    </div>
  );
}
