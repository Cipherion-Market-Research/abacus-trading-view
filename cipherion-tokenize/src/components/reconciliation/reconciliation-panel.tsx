"use client";

import { useState, useMemo, useRef } from "react";
import {
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Loader2,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddressDisplay } from "@/components/shared/address-display";
import { formatTokenAmount } from "@/lib/utils/format";
import { downloadCsv } from "@/lib/utils/csv";
import {
  reconcile,
  parseRegisterCsv,
  exportDiffCsv,
  type RegisterEntry,
  type ReconcileResult,
  type DiffRow,
  type DiffType,
} from "@/lib/utils/reconcile";
import { PublicKey } from "@solana/web3.js";
import { createAndThawAccount } from "@/lib/solana/account-service";
import { useSendTransaction } from "@/hooks/use-send-transaction";
import { useNetwork } from "@/hooks/use-network";
import { toastSuccess, toastError } from "@/hooks/use-toast";
import type { TokenInfo, HolderInfo } from "@/types/token";

interface ReconciliationPanelProps {
  token: TokenInfo;
  holders: HolderInfo[];
  onSuccess?: () => void;
}

const STORAGE_KEY = (mint: string) => `ciphex-atlas-register-${mint}`;

function loadRegister(mint: string): RegisterEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY(mint));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRegister(mint: string, entries: RegisterEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY(mint), JSON.stringify(entries));
}

const DIFF_CONFIG: Record<
  DiffType,
  { icon: typeof CheckCircle2; color: string; bg: string; label: string }
> = {
  match: {
    icon: CheckCircle2,
    color: "text-[#3fb950]",
    bg: "bg-[rgba(63,185,80,0.06)]",
    label: "Match",
  },
  balance_mismatch: {
    icon: AlertTriangle,
    color: "text-[#d29922]",
    bg: "bg-[rgba(210,153,34,0.06)]",
    label: "Balance mismatch",
  },
  status_mismatch: {
    icon: AlertTriangle,
    color: "text-[#d29922]",
    bg: "bg-[rgba(210,153,34,0.06)]",
    label: "Status mismatch",
  },
  both_mismatch: {
    icon: AlertTriangle,
    color: "text-[#d29922]",
    bg: "bg-[rgba(210,153,34,0.06)]",
    label: "Balance + status mismatch",
  },
  missing_onchain: {
    icon: XCircle,
    color: "text-[#f85149]",
    bg: "bg-[rgba(248,81,73,0.06)]",
    label: "Missing on-chain",
  },
  missing_register: {
    icon: Info,
    color: "text-[#58a6ff]",
    bg: "bg-[rgba(88,166,255,0.06)]",
    label: "Not in register",
  },
};

function DiffRowDisplay({
  row,
  decimals,
  symbol,
  onOnboard,
  isOnboarding,
}: {
  row: DiffRow;
  decimals: number;
  symbol: string;
  onOnboard?: (address: string) => void;
  isOnboarding: boolean;
}) {
  const config = DIFF_CONFIG[row.type];
  const Icon = config.icon;

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-lg border border-[#30363d] p-3 ${config.bg}`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Icon className={`size-3.5 shrink-0 ${config.color}`} />
        <AddressDisplay
          address={row.address}
          showExplorer
          className="text-[#f0f6fc]"
        />
      </div>

      <div className="flex items-center gap-4 sm:gap-6 pl-5.5 sm:pl-0 text-[11px] font-mono">
        {/* On-chain side */}
        <div className="min-w-[100px]">
          {row.onChain ? (
            <>
              <span className="text-[#f0f6fc]">
                {formatTokenAmount(row.onChain.balance, decimals)}
              </span>
              <span className="text-[#8b949e] ml-1">{symbol}</span>
              <span
                className={`ml-1.5 text-[9px] ${
                  row.onChain.isFrozen ? "text-[#d29922]" : "text-[#3fb950]"
                }`}
              >
                {row.onChain.isFrozen ? "Frozen" : "Active"}
              </span>
            </>
          ) : (
            <span className="text-[#484f58]">—</span>
          )}
        </div>

        {/* Status */}
        <span className={`text-[10px] font-medium ${config.color} min-w-[80px]`}>
          {config.label}
          {row.balanceDelta !== null && row.balanceDelta !== 0n && (
            <span className="ml-1 text-[#8b949e]">
              ({row.balanceDelta > 0n ? "+" : ""}
              {formatTokenAmount(row.balanceDelta, decimals)})
            </span>
          )}
        </span>

        {/* Register side */}
        <div className="min-w-[100px]">
          {row.register ? (
            <>
              <span className="text-[#f0f6fc]">{row.register.balance}</span>
              <span className="text-[#8b949e] ml-1">{symbol}</span>
              <span
                className={`ml-1.5 text-[9px] ${
                  row.register.status === "frozen"
                    ? "text-[#d29922]"
                    : "text-[#3fb950]"
                }`}
              >
                {row.register.status === "frozen" ? "Frozen" : "Active"}
              </span>
            </>
          ) : (
            <span className="text-[#484f58]">—</span>
          )}
        </div>
      </div>

      {/* Onboard action for missing_onchain */}
      {row.type === "missing_onchain" && onOnboard && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOnboard(row.address)}
          disabled={isOnboarding}
          className="gap-1 text-[10px] text-[#58a6ff] hover:text-[#58a6ff] hover:bg-[rgba(88,166,255,0.1)] shrink-0"
        >
          {isOnboarding ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <UserPlus className="size-3" />
          )}
          Onboard
        </Button>
      )}
    </div>
  );
}

export function ReconciliationPanel({
  token,
  holders,
  onSuccess,
}: ReconciliationPanelProps) {
  const mintStr = token.mint.toBase58();
  const [register, setRegister] = useState<RegisterEntry[]>(() =>
    loadRegister(mintStr)
  );
  const [isOnboarding, setIsOnboarding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { signAndSend, publicKey } = useSendTransaction();
  const { explorerTxUrl } = useNetwork();

  const result: ReconcileResult | null = useMemo(() => {
    if (register.length === 0) return null;
    return reconcile(holders, register, token.decimals);
  }, [holders, register, token.decimals]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text !== "string") return;
      const entries = parseRegisterCsv(text);
      setRegister(entries);
      saveRegister(mintStr, entries);
    };
    reader.readAsText(file);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const entries = parseRegisterCsv(text);
      if (entries.length > 0) {
        setRegister(entries);
        saveRegister(mintStr, entries);
        toastSuccess(`Parsed ${entries.length} register entries from clipboard`);
      } else {
        toastError("No valid entries found in clipboard");
      }
    } catch {
      toastError("Failed to read clipboard — check browser permissions");
    }
  };

  const handleExportDiff = () => {
    if (!result) return;
    const csv = exportDiffCsv(result, token.decimals);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `${token.symbol}_reconciliation_${date}.csv`);
  };

  const handleClear = () => {
    setRegister([]);
    localStorage.removeItem(STORAGE_KEY(mintStr));
  };

  const handleOnboard = async (address: string) => {
    if (!publicKey) return;
    setIsOnboarding(true);
    try {
      const result = await createAndThawAccount(
        token.mint,
        new PublicKey(address),
        publicKey,
        signAndSend
      );
      toastSuccess("Investor onboarded", {
        description: `${address.slice(0, 8)}... now has a token account.`,
        action: { label: "View TX", href: explorerTxUrl(result.signature) },
      });
      onSuccess?.();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Onboard failed");
    } finally {
      setIsOnboarding(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload controls */}
      <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
        <p className="text-[11px] uppercase tracking-wider text-[#8b949e] mb-3">
          Official Register
        </p>
        <p className="text-xs text-[#8b949e] mb-3">
          Upload a CSV (or paste from clipboard) with columns:{" "}
          <code className="text-[#f0f6fc] bg-[#21262d] px-1 py-0.5 rounded text-[10px]">
            wallet_address, balance, status
          </code>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5 border-[#30363d] bg-[#0d1117] text-[#8b949e] hover:text-[#f0f6fc]"
          >
            <Upload className="size-3" />
            Upload CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePaste}
            className="gap-1.5 border-[#30363d] bg-[#0d1117] text-[#8b949e] hover:text-[#f0f6fc]"
          >
            Paste from clipboard
          </Button>
          {register.length > 0 && (
            <>
              <span className="text-[10px] text-[#3fb950] font-mono">
                {register.length} entries loaded
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-[10px] text-[#8b949e] hover:text-[#f85149]"
              >
                Clear
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Summary bar */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#30363d] bg-[#161b22] px-4 py-3">
            <span className="text-xs text-[#3fb950] font-medium">
              {result.matched} matched
            </span>
            {result.balanceMismatches > 0 && (
              <span className="text-xs text-[#d29922] font-medium">
                {result.balanceMismatches} balance{" "}
                {result.balanceMismatches === 1 ? "mismatch" : "mismatches"}
              </span>
            )}
            {result.statusMismatches > 0 && (
              <span className="text-xs text-[#d29922] font-medium">
                {result.statusMismatches} status{" "}
                {result.statusMismatches === 1 ? "mismatch" : "mismatches"}
              </span>
            )}
            {result.missingOnChain > 0 && (
              <span className="text-xs text-[#f85149] font-medium">
                {result.missingOnChain} missing on-chain
              </span>
            )}
            {result.missingRegister > 0 && (
              <span className="text-xs text-[#58a6ff] font-medium">
                {result.missingRegister} not in register
              </span>
            )}
            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportDiff}
                className="gap-1.5 border-[#30363d] bg-[#0d1117] text-[#8b949e] hover:text-[#f0f6fc]"
              >
                <Download className="size-3" />
                Export diff
              </Button>
            </div>
          </div>

          {/* Column headers */}
          <div className="hidden sm:flex items-center gap-4 px-3 text-[10px] uppercase tracking-wider text-[#6e7681]">
            <div className="flex-1">Address</div>
            <div className="flex items-center gap-4 sm:gap-6 font-mono">
              <div className="min-w-[100px]">On-Chain</div>
              <div className="min-w-[80px]">Status</div>
              <div className="min-w-[100px]">Register</div>
            </div>
            <div className="w-[80px]" />
          </div>

          {/* Diff rows */}
          <div className="space-y-1.5">
            {result.rows.map((row) => (
              <DiffRowDisplay
                key={row.address}
                row={row}
                decimals={token.decimals}
                symbol={token.symbol}
                onOnboard={
                  row.type === "missing_onchain" ? handleOnboard : undefined
                }
                isOnboarding={isOnboarding}
              />
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {register.length === 0 && (
        <div className="rounded-lg border border-dashed border-[#30363d] bg-[#0d1117] p-8 text-center">
          <Upload className="size-6 text-[#484f58] mx-auto mb-2" />
          <p className="text-sm text-[#8b949e]">
            Upload your investor register to compare against on-chain state.
          </p>
          <p className="text-[10px] text-[#6e7681] mt-1">
            Accepts CSV or tab-separated values. Persists across page reloads.
          </p>
        </div>
      )}
    </div>
  );
}
