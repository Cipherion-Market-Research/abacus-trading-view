"use client";

import { useState } from "react";
import { UserPlus, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOnboardInvestor } from "@/hooks/use-compliance";
import { isValidPublicKey } from "@/lib/utils/validation";

interface OnboardFormProps {
  mintAddress: string;
  onSuccess?: () => void;
}

export function OnboardForm({ mintAddress, onSuccess }: OnboardFormProps) {
  const { onboard, isLoading } = useOnboardInvestor();
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [address, setAddress] = useState("");
  const [batchAddresses, setBatchAddresses] = useState("");
  const [batchResults, setBatchResults] = useState<
    { address: string; status: "success" | "error"; message: string }[]
  >([]);

  const handleSingle = async () => {
    if (!isValidPublicKey(address.trim())) return;
    const result = await onboard(mintAddress, address.trim());
    if (result) {
      setAddress("");
      onSuccess?.();
    }
  };

  const handleBatch = async () => {
    const addresses = batchAddresses
      .split("\n")
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    if (addresses.length === 0) return;

    const results: typeof batchResults = [];
    for (const addr of addresses) {
      if (!isValidPublicKey(addr)) {
        results.push({ address: addr, status: "error", message: "Invalid address" });
        continue;
      }
      const result = await onboard(mintAddress, addr);
      results.push({
        address: addr,
        status: result ? "success" : "error",
        message: result ? "Onboarded" : "Failed",
      });
    }
    setBatchResults(results);
    onSuccess?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <UserPlus className="size-4 text-[#3fb950]" />
        <h3 className="text-sm font-semibold text-[#f0f6fc]">
          Onboard Investor
        </h3>
      </div>

      <div className="flex gap-1 mb-3">
        <button
          onClick={() => setMode("single")}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            mode === "single"
              ? "bg-[#21262d] text-[#f0f6fc]"
              : "text-[#8b949e] hover:text-[#f0f6fc]"
          }`}
        >
          Single
        </button>
        <button
          onClick={() => setMode("batch")}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            mode === "batch"
              ? "bg-[#21262d] text-[#f0f6fc]"
              : "text-[#8b949e] hover:text-[#f0f6fc]"
          }`}
        >
          <Users className="inline size-3 mr-1" />
          Batch
        </button>
      </div>

      {mode === "single" ? (
        <div className="flex gap-2">
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Investor wallet address (pubkey)"
            className="flex-1 border-[#30363d] bg-[#0d1117] text-[#f0f6fc] font-mono text-xs placeholder:text-[#484f58]"
          />
          <Button
            size="sm"
            onClick={handleSingle}
            disabled={isLoading || !isValidPublicKey(address.trim())}
            className="gap-1.5 bg-[#238636] text-white hover:bg-[#2ea043] shrink-0"
          >
            {isLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <UserPlus className="size-3.5" />
            )}
            Onboard
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={batchAddresses}
            onChange={(e) => setBatchAddresses(e.target.value)}
            placeholder="One wallet address per line"
            rows={5}
            className="w-full rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2 text-xs font-mono text-[#f0f6fc] placeholder:text-[#484f58] focus:outline-none focus:ring-2 focus:ring-[#238636]/50"
          />
          <Button
            size="sm"
            onClick={handleBatch}
            disabled={isLoading || batchAddresses.trim().length === 0}
            className="gap-1.5 bg-[#238636] text-white hover:bg-[#2ea043]"
          >
            {isLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Users className="size-3.5" />
            )}
            Onboard All
          </Button>
          {batchResults.length > 0 && (
            <div className="space-y-1 mt-2">
              {batchResults.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 text-xs font-mono ${
                    r.status === "success" ? "text-[#3fb950]" : "text-[#f85149]"
                  }`}
                >
                  <span>{r.status === "success" ? "✓" : "✗"}</span>
                  <span className="truncate">{r.address}</span>
                  <span className="text-[#8b949e]">{r.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-[#8b949e]">
        Creates a token account for the investor and approves KYC (thaws the
        frozen account).
      </p>
    </div>
  );
}
