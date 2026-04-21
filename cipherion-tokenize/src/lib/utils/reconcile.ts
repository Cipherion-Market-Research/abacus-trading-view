import type { HolderInfo } from "@/types/token";

export interface RegisterEntry {
  address: string;
  balance: string;
  status: "active" | "frozen";
}

export type DiffType =
  | "match"
  | "balance_mismatch"
  | "status_mismatch"
  | "both_mismatch"
  | "missing_onchain"
  | "missing_register";

export interface DiffRow {
  address: string;
  type: DiffType;
  onChain: {
    balance: bigint;
    isFrozen: boolean;
  } | null;
  register: RegisterEntry | null;
  balanceDelta: bigint | null;
}

export interface ReconcileResult {
  rows: DiffRow[];
  matched: number;
  balanceMismatches: number;
  statusMismatches: number;
  missingOnChain: number;
  missingRegister: number;
}

export function reconcile(
  holders: HolderInfo[],
  register: RegisterEntry[],
  decimals: number
): ReconcileResult {
  const onChainMap = new Map<string, HolderInfo>();
  for (const h of holders) {
    onChainMap.set(h.owner.toBase58(), h);
  }

  const registerMap = new Map<string, RegisterEntry>();
  for (const r of register) {
    registerMap.set(r.address, r);
  }

  const allAddresses = new Set([
    ...onChainMap.keys(),
    ...registerMap.keys(),
  ]);

  const rows: DiffRow[] = [];
  let matched = 0;
  let balanceMismatches = 0;
  let statusMismatches = 0;
  let missingOnChain = 0;
  let missingRegister = 0;

  for (const addr of allAddresses) {
    const holder = onChainMap.get(addr);
    const entry = registerMap.get(addr);

    if (holder && entry) {
      const registerBalance = parseBalanceString(entry.balance, decimals);
      const balanceMatch = holder.balance === registerBalance;
      const statusMatch =
        (holder.isFrozen && entry.status === "frozen") ||
        (!holder.isFrozen && entry.status === "active");

      let type: DiffType;
      if (balanceMatch && statusMatch) {
        type = "match";
        matched++;
      } else if (!balanceMatch && !statusMatch) {
        type = "both_mismatch";
        balanceMismatches++;
        statusMismatches++;
      } else if (!balanceMatch) {
        type = "balance_mismatch";
        balanceMismatches++;
      } else {
        type = "status_mismatch";
        statusMismatches++;
      }

      rows.push({
        address: addr,
        type,
        onChain: { balance: holder.balance, isFrozen: holder.isFrozen },
        register: entry,
        balanceDelta: holder.balance - registerBalance,
      });
    } else if (holder && !entry) {
      rows.push({
        address: addr,
        type: "missing_register",
        onChain: { balance: holder.balance, isFrozen: holder.isFrozen },
        register: null,
        balanceDelta: null,
      });
      missingRegister++;
    } else if (!holder && entry) {
      rows.push({
        address: addr,
        type: "missing_onchain",
        onChain: null,
        register: entry,
        balanceDelta: null,
      });
      missingOnChain++;
    }
  }

  // Sort: mismatches and missing first, then matches
  const order: Record<DiffType, number> = {
    missing_onchain: 0,
    missing_register: 1,
    both_mismatch: 2,
    balance_mismatch: 3,
    status_mismatch: 4,
    match: 5,
  };
  rows.sort((a, b) => order[a.type] - order[b.type]);

  return {
    rows,
    matched,
    balanceMismatches,
    statusMismatches,
    missingOnChain,
    missingRegister,
  };
}

function parseBalanceString(value: string, decimals: number): bigint {
  const trimmed = value.trim().replace(/,/g, "");
  const num = parseFloat(trimmed);
  if (isNaN(num)) return 0n;
  return BigInt(Math.round(num * 10 ** decimals));
}

export function parseRegisterCsv(csv: string): RegisterEntry[] {
  const lines = csv.trim().split("\n");
  const entries: RegisterEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip header row if it looks like one
    if (i === 0 && /address|wallet/i.test(line)) continue;

    // Support both comma and tab delimiters
    const parts = line.includes("\t") ? line.split("\t") : line.split(",");

    const address = parts[0]?.trim();
    const balance = parts[1]?.trim() ?? "0";
    const rawStatus = parts[2]?.trim()?.toLowerCase() ?? "active";
    const status = rawStatus === "frozen" ? "frozen" : "active";

    if (address && address.length >= 32) {
      entries.push({ address, balance, status });
    }
  }

  return entries;
}

export function exportDiffCsv(
  result: ReconcileResult,
  decimals: number
): string {
  const headers = [
    "Address",
    "Status",
    "On-Chain Balance",
    "On-Chain Frozen",
    "Register Balance",
    "Register Status",
    "Balance Delta",
  ];

  const formatBal = (raw: bigint): string => {
    const divisor = BigInt(10 ** decimals);
    const whole = raw / divisor;
    const frac = raw % divisor;
    if (frac === 0n) return whole.toString();
    const fracStr = (frac < 0n ? -frac : frac)
      .toString()
      .padStart(decimals, "0")
      .replace(/0+$/, "");
    return `${whole}.${fracStr}`;
  };

  const rows = result.rows.map((r) => [
    r.address,
    r.type,
    r.onChain ? formatBal(r.onChain.balance) : "",
    r.onChain ? (r.onChain.isFrozen ? "Frozen" : "Active") : "",
    r.register?.balance ?? "",
    r.register?.status ?? "",
    r.balanceDelta !== null ? formatBal(r.balanceDelta) : "",
  ]);

  const headerLine = headers.join(",");
  const dataLines = rows.map((row) => row.join(","));
  return [headerLine, ...dataLines].join("\n");
}
