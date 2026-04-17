"use client";

import { useEffect, useState } from "react";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { useTokenCreate } from "@/hooks/use-token-create";
import { formatSol } from "@/lib/utils/format";
import type { WizardState } from "../create-wizard";
import type { CreateTokenParams } from "@/types/token";

interface Props {
  state: WizardState;
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between py-1.5">
      <span className="text-xs text-[#8b949e] shrink-0">{label}</span>
      <span
        className={`text-xs text-[#f0f6fc] text-right ${mono ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function Badge({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
        enabled
          ? "bg-[rgba(63,185,80,0.15)] text-[#3fb950]"
          : "bg-[rgba(139,148,158,0.1)] text-[#484f58]"
      }`}
    >
      {enabled ? <CheckCircle className="size-2.5" /> : null}
      {label}
    </span>
  );
}

export function ReviewStep({ state }: Props) {
  const { estimate } = useTokenCreate();
  const [costLamports, setCostLamports] = useState<number | null>(null);
  const { basicInfo, compliance, supply, metadata } = state;

  useEffect(() => {
    const decimals = basicInfo.decimals;
    const multiplier = BigInt(10 ** decimals);

    const params: CreateTokenParams = {
      name: basicInfo.name,
      symbol: basicInfo.symbol,
      decimals,
      uri: metadata.externalUri || "",
      description: basicInfo.description,
      assetType: basicInfo.assetType,
      regulatoryFramework: metadata.regulatoryFramework as CreateTokenParams["regulatoryFramework"],
      extensions: {
        defaultAccountState: compliance.enableKycGating ? "frozen" : "initialized",
        transferFee: compliance.enableTransferFees
          ? {
              bps: compliance.transferFeeBps,
              maxFee: compliance.transferFeeMax
                ? BigInt(Math.floor(parseFloat(compliance.transferFeeMax) * Number(multiplier)))
                : multiplier * 1000n,
            }
          : undefined,
        pausable: compliance.enablePause,
        permanentDelegate: compliance.enablePermanentDelegate ? undefined : undefined,
        memoTransfer: compliance.enableMemoRequired,
      },
      initialSupply: supply.initialSupply
        ? BigInt(Math.floor(parseFloat(supply.initialSupply) * Number(multiplier)))
        : undefined,
      metadata: metadata.fields.filter((f) => f.key && f.value),
    };

    estimate(params).then((r) => {
      if (r) setCostLamports(r.lamports);
    });
  }, [state, estimate, basicInfo, compliance, supply, metadata]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-[#f0f6fc] mb-1">
          Review & Create
        </h2>
        <p className="text-xs text-[#8b949e]">
          Verify all parameters before creating. Extensions cannot be changed
          after creation.
        </p>
      </div>

      <div className="space-y-4">
        {/* Token Identity */}
        <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-4">
          <p className="text-[11px] uppercase tracking-wider text-[#8b949e] mb-2">
            Token Identity
          </p>
          <Row label="Name" value={basicInfo.name || "—"} />
          <Row label="Symbol" value={basicInfo.symbol || "—"} mono />
          <Row label="Decimals" value={String(basicInfo.decimals)} mono />
          <Row label="Asset Type" value={basicInfo.assetType} />
          {basicInfo.description && (
            <Row label="Description" value={basicInfo.description} />
          )}
        </div>

        {/* Compliance Extensions */}
        <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-4">
          <p className="text-[11px] uppercase tracking-wider text-[#8b949e] mb-2">
            Compliance Extensions
          </p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            <Badge enabled={compliance.enableKycGating} label="KYC Gating" />
            <Badge enabled={compliance.enableTransferFees} label="Transfer Fees" />
            <Badge enabled={compliance.enablePause} label="Pausable" />
            <Badge
              enabled={compliance.enablePermanentDelegate}
              label="Permanent Delegate"
            />
            <Badge enabled={compliance.enableMemoRequired} label="Memo Required" />
          </div>
          {compliance.enableTransferFees && (
            <Row
              label="Transfer Fee"
              value={`${(compliance.transferFeeBps / 100).toFixed(2)}% (max: ${compliance.transferFeeMax || "default"})`}
            />
          )}
          {compliance.enablePermanentDelegate && (
            <div className="mt-2 flex items-start gap-1.5 text-[10px] text-[#d29922]">
              <AlertTriangle className="size-3 mt-0.5 shrink-0" />
              <span>
                Permanent Delegate grants unrestricted control over all holder
                balances.
              </span>
            </div>
          )}
        </div>

        {/* Supply */}
        <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-4">
          <p className="text-[11px] uppercase tracking-wider text-[#8b949e] mb-2">
            Supply
          </p>
          <Row
            label="Initial Supply"
            value={supply.initialSupply || "0 (mint later)"}
            mono
          />
        </div>

        {/* Metadata */}
        {metadata.fields.filter((f) => f.key && f.value).length > 0 && (
          <div className="rounded-lg border border-[#30363d] bg-[#0d1117] p-4">
            <p className="text-[11px] uppercase tracking-wider text-[#8b949e] mb-2">
              On-Chain Metadata
            </p>
            {metadata.jurisdiction && (
              <Row label="Jurisdiction" value={metadata.jurisdiction} />
            )}
            {metadata.regulatoryFramework !== "none" && (
              <Row
                label="Framework"
                value={metadata.regulatoryFramework}
              />
            )}
            {metadata.fields
              .filter((f) => f.key && f.value)
              .map((f, i) => (
                <Row key={i} label={f.key} value={f.value} />
              ))}
          </div>
        )}

        {/* Cost Estimate */}
        <div className="rounded-lg border border-[#238636]/30 bg-[rgba(35,134,54,0.05)] p-4">
          <p className="text-[11px] uppercase tracking-wider text-[#3fb950] mb-2">
            Estimated Cost
          </p>
          <Row
            label="Rent deposit (refundable)"
            value={
              costLamports !== null
                ? `${formatSol(costLamports)} SOL`
                : "Calculating..."
            }
            mono
          />
          <Row label="Transaction fee" value="~0.000005 SOL" mono />
        </div>
      </div>
    </div>
  );
}
