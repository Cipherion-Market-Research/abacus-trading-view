"use client";

import { Input } from "@/components/ui/input";
import { Coins } from "lucide-react";

export interface SupplyData {
  initialSupply: string;
}

interface Props {
  data: SupplyData;
  decimals: number;
  onChange: (data: SupplyData) => void;
}

export function SupplyStep({ data, decimals, onChange }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Coins className="size-4 text-[#3fb950]" />
          <h2 className="text-sm font-semibold text-[#f0f6fc]">
            Supply & Authorities
          </h2>
        </div>
        <p className="text-xs text-[#8b949e]">
          Configure the initial token supply. Your connected wallet will be set
          as the mint and freeze authority.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-[#8b949e] mb-1 block">
            Initial Supply
          </label>
          <Input
            value={data.initialSupply}
            onChange={(e) =>
              onChange({ ...data, initialSupply: e.target.value })
            }
            placeholder="e.g. 1000000"
            className="border-[#30363d] bg-[#0d1117] text-[#f0f6fc] font-mono placeholder:text-[#484f58]"
          />
          <p className="mt-1 text-[10px] text-[#8b949e]">
            Leave empty to start with 0 supply. You can mint more later.
            {decimals > 0 &&
              ` Token uses ${decimals} decimals.`}
          </p>
        </div>

        <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-4 space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-[#8b949e]">
            Authorities (auto-assigned)
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#8b949e]">Mint Authority</span>
              <span className="text-xs font-mono text-[#f0f6fc]">
                Your wallet
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#8b949e]">Freeze Authority</span>
              <span className="text-xs font-mono text-[#f0f6fc]">
                Your wallet
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#8b949e]">Update Authority</span>
              <span className="text-xs font-mono text-[#f0f6fc]">
                Your wallet
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
