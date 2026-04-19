"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddressDisplay } from "@/components/shared/address-display";
import { formatTokenAmount } from "@/lib/utils/format";
import type { HolderInfo } from "@/types/token";

interface CapTableProps {
  holders: HolderInfo[];
  decimals: number;
  totalSupply: bigint;
}

function StatusBadge({ frozen }: { frozen: boolean }) {
  if (frozen) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-[rgba(210,153,34,0.15)] text-[#d29922]">
        Frozen
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-[rgba(63,185,80,0.15)] text-[#3fb950]">
      Active
    </span>
  );
}

export function CapTable({ holders, decimals, totalSupply }: CapTableProps) {
  if (holders.length === 0) {
    return (
      <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-8 text-center">
        <p className="text-sm text-[#8b949e]">No token holders yet.</p>
        <p className="text-xs text-[#484f58] mt-1">
          Onboard investors to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#30363d] overflow-hidden">
      {/* Desktop / tablet table */}
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow className="border-[#30363d] bg-[#161b22] hover:bg-[#161b22]">
              <TableHead className="text-[10px] uppercase tracking-wider text-[#8b949e]">
                Owner
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-[#8b949e] text-right">
                Balance
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-[#8b949e] text-right">
                % Supply
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider text-[#8b949e]">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holders.map((holder) => {
              const pct =
                totalSupply > 0n
                  ? Number((holder.balance * 10000n) / totalSupply) / 100
                  : 0;
              return (
                <TableRow
                  key={holder.address.toBase58()}
                  className="border-[#30363d] hover:bg-[#161b22]"
                >
                  <TableCell>
                    <AddressDisplay
                      address={holder.owner.toBase58()}
                      showExplorer
                      className="text-[#f0f6fc]"
                    />
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-[#f0f6fc]">
                    {formatTokenAmount(holder.balance, decimals)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-[#8b949e]">
                    {pct.toFixed(2)}%
                  </TableCell>
                  <TableCell>
                    <StatusBadge frozen={holder.isFrozen} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden divide-y divide-[#30363d]">
        {holders.map((holder) => {
          const pct =
            totalSupply > 0n
              ? Number((holder.balance * 10000n) / totalSupply) / 100
              : 0;
          return (
            <div
              key={holder.address.toBase58()}
              className="bg-[#0d1117] p-4 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <AddressDisplay
                  address={holder.owner.toBase58()}
                  showExplorer
                  className="text-[#f0f6fc] min-w-0"
                />
                <StatusBadge frozen={holder.isFrozen} />
              </div>
              <div className="flex items-baseline justify-between gap-3 pt-1">
                <span className="font-mono text-[15px] font-semibold text-[#f0f6fc]">
                  {formatTokenAmount(holder.balance, decimals)}
                </span>
                <span className="font-mono text-[11px] text-[#8b949e]">
                  {pct.toFixed(2)}% of supply
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
