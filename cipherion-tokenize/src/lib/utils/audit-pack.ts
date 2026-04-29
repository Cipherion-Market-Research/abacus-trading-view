import JSZip from "jszip";
import { PublicKey } from "@solana/web3.js";
import { generateCsv } from "./csv";
import { getTokenTransactions } from "@/lib/solana/history-service";
import { loadDistributions, fetchDistributionsFromServer } from "@/lib/distributions";
import { formatTokenAmount } from "@/lib/utils/format";
import type { TokenInfo, HolderInfo, TransactionInfo } from "@/types/token";

const MAX_TX_PAGES = 50;
const TX_PAGE_SIZE = 10;
const TX_CAP = 500;

async function fetchAllTransactions(
  mint: PublicKey
): Promise<TransactionInfo[]> {
  const all: TransactionInfo[] = [];
  let before: string | undefined;

  for (let page = 0; page < MAX_TX_PAGES; page++) {
    const batch = await getTokenTransactions(mint, {
      before,
      limit: TX_PAGE_SIZE,
    });
    if (batch.length === 0) break;
    all.push(...batch);
    if (all.length >= TX_CAP) break;
    if (batch.length < TX_PAGE_SIZE) break;
    before = batch[batch.length - 1].signature;
  }

  return all.slice(0, TX_CAP);
}

function buildHoldersCsv(
  holders: HolderInfo[],
  decimals: number,
  totalSupply: bigint
): string {
  const headers = [
    "Owner Address",
    "ATA Address",
    "Balance",
    "% Supply",
    "Status",
  ];
  const rows = holders.map((h) => {
    const pct =
      totalSupply > 0n
        ? ((Number(h.balance) / Number(totalSupply)) * 100).toFixed(4)
        : "0";
    return [
      h.owner.toBase58(),
      h.address.toBase58(),
      formatTokenAmount(h.balance, decimals),
      pct,
      h.isFrozen ? "Frozen" : "Active",
    ];
  });
  return generateCsv(headers, rows);
}

function buildTransactionsCsv(transactions: TransactionInfo[]): string {
  const headers = ["Signature", "Timestamp", "Type", "Memo"];
  const rows = transactions.map((tx) => [
    tx.signature,
    tx.blockTime
      ? new Date(tx.blockTime * 1000).toISOString()
      : "unknown",
    tx.type,
    tx.memo ?? "",
  ]);
  return generateCsv(headers, rows);
}

async function buildDistributionsCsv(
  mintAddress: string,
  decimals: number
): Promise<{ csv: string; source: "server" | "local" }> {
  let records = loadDistributions(mintAddress);
  let source: "server" | "local" = "local";

  try {
    const { records: serverRecords, configured } =
      await fetchDistributionsFromServer(mintAddress);
    if (configured && serverRecords.length > 0) {
      records = serverRecords;
      source = "server";
    }
  } catch {
    // Fall through to localStorage
  }

  const headers = [
    "Distribution ID",
    "Date",
    "Memo",
    "Total Allocated",
    "Status",
    "Recipient Address",
    "Recipient Amount",
    "Recipient Status",
    "Recipient TX",
  ];
  const rows: string[][] = [];

  if (source === "local" && records.length > 0) {
    rows.push([
      "⚠ WARNING: Data sourced from browser localStorage — server was unavailable. Verify against on-chain records.",
      "", "", "", "", "", "", "", "",
    ]);
  }

  for (const record of records) {
    for (const r of record.recipients) {
      const amount = Number(BigInt(r.amount)) / Math.pow(10, decimals);
      rows.push([
        record.id,
        new Date(record.timestamp).toISOString(),
        record.memo,
        formatTokenAmount(BigInt(record.totalAllocated), decimals),
        record.status,
        r.ownerAddress,
        amount.toString(),
        r.status,
        r.signature ?? "",
      ]);
    }
  }
  return { csv: generateCsv(headers, rows), source };
}

function buildMetadataJson(
  token: TokenInfo,
  holders: HolderInfo[]
): string {
  return JSON.stringify(
    {
      mint: token.mint.toBase58(),
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      supply: token.supply.toString(),
      mintAuthority: token.mintAuthority?.toBase58() ?? null,
      freezeAuthority: token.freezeAuthority?.toBase58() ?? null,
      extensions: token.extensions,
      metadata: token.metadata,
      uri: token.uri,
      holderCount: holders.length,
    },
    null,
    2
  );
}

function buildReadme(
  token: TokenInfo,
  network: string,
  txCount: number,
  holderCount: number,
  distSource: "server" | "local"
): string {
  const distNote =
    distSource === "server"
      ? "distribution records (server-verified)"
      : "distribution records (LOCAL CACHE — server unavailable, verify against chain)";
  return [
    `Atlas Audit Pack`,
    `================`,
    ``,
    `Token:    ${token.name} (${token.symbol})`,
    `Mint:     ${token.mint.toBase58()}`,
    `Network:  ${network}`,
    `Exported: ${new Date().toISOString()}`,
    ``,
    `Contents:`,
    `  holders.csv         — ${holderCount} holder(s)`,
    `  transactions.csv    — ${txCount} transaction(s)`,
    `  distributions.csv   — ${distNote}`,
    `  token_metadata.json — full token configuration snapshot`,
    ``,
    `Disclaimer:`,
    `  This export is a point-in-time snapshot. On-chain state is the`,
    `  authoritative source of truth. Verify all data against the Solana`,
    `  Explorer before relying on it for regulatory or audit purposes.`,
    ``,
    `  Generated by Atlas — https://ciphex.io`,
  ].join("\n");
}

export interface AuditPackOptions {
  token: TokenInfo;
  holders: HolderInfo[];
  network: string;
}

export async function generateAuditPack({
  token,
  holders,
  network,
}: AuditPackOptions): Promise<void> {
  const zip = new JSZip();
  const mintStr = token.mint.toBase58();

  const transactions = await fetchAllTransactions(token.mint);

  const { csv: distributionsCsv, source: distSource } =
    await buildDistributionsCsv(mintStr, token.decimals);

  zip.file("holders.csv", buildHoldersCsv(holders, token.decimals, token.supply));
  zip.file("transactions.csv", buildTransactionsCsv(transactions));
  zip.file("distributions.csv", distributionsCsv);
  zip.file("token_metadata.json", buildMetadataJson(token, holders));
  zip.file(
    "README.txt",
    buildReadme(token, network, transactions.length, holders.length, distSource)
  );

  const blob = await zip.generateAsync({ type: "blob" });
  const date = new Date().toISOString().slice(0, 10);
  const filename = `Atlas_Audit_Pack_${token.symbol}_${date}.zip`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
