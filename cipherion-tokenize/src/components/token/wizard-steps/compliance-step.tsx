"use client";

import { Input } from "@/components/ui/input";
import { Shield, AlertTriangle } from "lucide-react";

export interface ComplianceData {
  enableKycGating: boolean;
  enableTransferFees: boolean;
  transferFeeBps: number;
  transferFeeMax: string;
  enablePause: boolean;
  enablePermanentDelegate: boolean;
}

interface Props {
  data: ComplianceData;
  onChange: (data: ComplianceData) => void;
}

function Toggle({
  label,
  description,
  checked,
  onChange,
  warning,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  warning?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#30363d] bg-[#0d1117] p-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
          checked ? "bg-[#238636]" : "bg-[#30363d]"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform mt-0.5 ${
            checked ? "translate-x-4 ml-0.5" : "translate-x-0.5"
          }`}
        />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#f0f6fc]">{label}</p>
        <p className="text-xs text-[#8b949e] mt-0.5">{description}</p>
        {warning && checked && (
          <div className="mt-2 flex items-start gap-1.5 text-[10px] text-[#d29922]">
            <AlertTriangle className="size-3 mt-0.5 shrink-0" />
            <span>{warning}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ComplianceStep({ data, onChange }: Props) {
  const update = <K extends keyof ComplianceData>(
    key: K,
    value: ComplianceData[K]
  ) => {
    onChange({ ...data, [key]: value });
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Shield className="size-4 text-[#58a6ff]" />
          <h2 className="text-sm font-semibold text-[#f0f6fc]">
            Compliance Configuration
          </h2>
        </div>
        <p className="text-xs text-[#8b949e]">
          Extensions are set at creation and cannot be changed later.
        </p>
      </div>

      <div className="space-y-3">
        <Toggle
          label="KYC Gating"
          description="New token accounts start frozen. Issuer must approve (thaw) each investor before they can hold or transfer tokens."
          checked={data.enableKycGating}
          onChange={(v) => update("enableKycGating", v)}
        />

        <Toggle
          label="Transfer Fees"
          description="Automatically deduct a fee on every transfer. Fee is taken from the recipient's received amount."
          checked={data.enableTransferFees}
          onChange={(v) => update("enableTransferFees", v)}
        />

        {data.enableTransferFees && (
          <div className="ml-12 grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#8b949e] mb-1 block">
                Fee (basis points)
              </label>
              <Input
                type="number"
                value={data.transferFeeBps}
                onChange={(e) =>
                  update(
                    "transferFeeBps",
                    Math.min(10000, Math.max(0, parseInt(e.target.value) || 0))
                  )
                }
                min={0}
                max={10000}
                className="border-[#30363d] bg-[#0d1117] text-[#f0f6fc]"
              />
              <p className="mt-0.5 text-[10px] text-[#8b949e]">
                {(data.transferFeeBps / 100).toFixed(2)}%
              </p>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#8b949e] mb-1 block">
                Max Fee (tokens)
              </label>
              <Input
                value={data.transferFeeMax}
                onChange={(e) => update("transferFeeMax", e.target.value)}
                placeholder="e.g. 1000"
                className="border-[#30363d] bg-[#0d1117] text-[#f0f6fc] placeholder:text-[#484f58]"
              />
            </div>
          </div>
        )}

        <Toggle
          label="Pausable"
          description="Authority can halt all minting, burning, and transfers. Use for regulatory emergencies or NAV recalculations."
          checked={data.enablePause}
          onChange={(v) => update("enablePause", v)}
        />

        <Toggle
          label="Permanent Delegate"
          description="Designated authority can transfer or burn tokens from any account. Required for regulatory seizure or forced redemption."
          checked={data.enablePermanentDelegate}
          onChange={(v) => update("enablePermanentDelegate", v)}
          warning="This grants unrestricted control over all holder balances. Wallets will display a warning to holders."
        />
      </div>
    </div>
  );
}
