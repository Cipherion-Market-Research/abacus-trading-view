"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTransfer } from "@/hooks/use-transfer";
import { useTransferFee } from "@/hooks/use-transfer-fee";
import { isValidPublicKey } from "@/lib/utils/validation";
import { formatTokenAmount } from "@/lib/utils/format";
import { calculateTransferFee } from "@/lib/utils/transfer-fee";
import type { PortfolioToken } from "@/hooks/use-portfolio";

interface TransferFormProps {
  token: PortfolioToken;
  onSuccess?: () => void;
}

export function TransferForm({ token, onSuccess }: TransferFormProps) {
  const { transfer, isLoading } = useTransfer();
  const { fee: feeConfig } = useTransferFee(token.mint);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const numAmount = parseFloat(amount);
  const rawAmount =
    !isNaN(numAmount) && numAmount > 0
      ? BigInt(Math.floor(numAmount * 10 ** token.decimals))
      : 0n;
  const maxBalance = token.balance;
  const maxFormatted = formatTokenAmount(maxBalance, token.decimals);
  const isValid =
    rawAmount > 0n &&
    rawAmount <= maxBalance &&
    isValidPublicKey(recipient.trim());

  const feeAmount = feeConfig
    ? calculateTransferFee(rawAmount, feeConfig.bps, feeConfig.maxFee)
    : 0n;
  const recipientReceives = rawAmount > feeAmount ? rawAmount - feeAmount : 0n;

  const handleMax = () => {
    setAmount(formatTokenAmount(maxBalance, token.decimals).replace(/,/g, ""));
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    const result = await transfer(
      token.mint.toBase58(),
      recipient.trim(),
      rawAmount,
      token.decimals
    );
    if (result) {
      setRecipient("");
      setAmount("");
      setShowConfirm(false);
      onSuccess?.();
    } else {
      setShowConfirm(false);
    }
  };

  if (token.isFrozen) {
    return (
      <div className="rounded-lg border border-[#d29922]/30 bg-[rgba(210,153,34,0.05)] p-4 text-center">
        <p className="text-sm text-[#d29922]">
          Your account is frozen for this token. Contact the issuer to approve
          your account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] uppercase tracking-wider text-[#8b949e] mb-1 block">
          Recipient Address
        </label>
        <Input
          value={recipient}
          onChange={(e) => {
            setRecipient(e.target.value);
            setShowConfirm(false);
          }}
          placeholder="Recipient wallet address"
          className="border-[#30363d] bg-[#0d1117] text-[#f0f6fc] font-mono text-xs placeholder:text-[#484f58]"
        />
        {recipient && !isValidPublicKey(recipient.trim()) && (
          <p className="mt-1 text-[10px] text-[#f85149]">Invalid address</p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] uppercase tracking-wider text-[#8b949e]">
            Amount
          </label>
          <button
            onClick={handleMax}
            className="text-[10px] text-[#58a6ff] hover:underline"
          >
            Max: {maxFormatted} {token.symbol}
          </button>
        </div>
        <Input
          type="text"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setShowConfirm(false);
          }}
          placeholder="0.00"
          className="border-[#30363d] bg-[#0d1117] text-[#f0f6fc] font-mono placeholder:text-[#484f58]"
        />
        {rawAmount > maxBalance && (
          <p className="mt-1 text-[10px] text-[#f85149]">
            Exceeds balance
          </p>
        )}
      </div>

      {feeConfig && feeConfig.bps > 0 && rawAmount > 0n && rawAmount <= maxBalance && (
        <p className="text-[10px] text-[#8b949e]">
          {(feeConfig.bps / 100).toFixed(2)}% transfer fee — recipient receives{" "}
          <span className="font-mono text-[#f0f6fc]">
            {formatTokenAmount(recipientReceives, token.decimals)} {token.symbol}
          </span>
        </p>
      )}

      {showConfirm && isValid && (
        <div className="rounded-lg border border-[#238636]/30 bg-[rgba(35,134,54,0.05)] p-3 space-y-1">
          <p className="text-[11px] uppercase tracking-wider text-[#3fb950]">
            Confirm Transfer
          </p>
          <div className="flex justify-between text-xs">
            <span className="text-[#8b949e]">To</span>
            <span className="font-mono text-[#f0f6fc]">
              {recipient.trim().slice(0, 8)}...{recipient.trim().slice(-4)}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[#8b949e]">You send</span>
            <span className="font-mono text-[#f0f6fc]">
              {amount} {token.symbol}
            </span>
          </div>
          {feeConfig && feeConfig.bps > 0 && (
            <>
              <div className="flex justify-between text-xs">
                <span className="text-[#8b949e]">
                  Fee ({(feeConfig.bps / 100).toFixed(2)}%)
                </span>
                <span className="font-mono text-[#d29922]">
                  −{formatTokenAmount(feeAmount, token.decimals)} {token.symbol}
                </span>
              </div>
              <div className="flex justify-between text-xs pt-1 border-t border-[#238636]/20">
                <span className="text-[#8b949e]">Recipient receives</span>
                <span className="font-mono text-[#3fb950] font-semibold">
                  {formatTokenAmount(recipientReceives, token.decimals)} {token.symbol}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={isLoading || !isValid}
        className="w-full gap-1.5 bg-[#238636] text-white hover:bg-[#2ea043]"
      >
        {isLoading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Send className="size-3.5" />
        )}
        {showConfirm ? "Confirm & Send" : "Transfer"}
      </Button>
    </div>
  );
}
