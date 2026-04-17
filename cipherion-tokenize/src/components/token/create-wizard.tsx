"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { ChevronLeft, ChevronRight, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BasicInfoStep, type BasicInfoData } from "./wizard-steps/basic-info-step";
import { ComplianceStep, type ComplianceData } from "./wizard-steps/compliance-step";
import { SupplyStep, type SupplyData } from "./wizard-steps/supply-step";
import { MetadataStep, type MetadataData } from "./wizard-steps/metadata-step";
import { ReviewStep } from "./wizard-steps/review-step";
import { useTokenCreate } from "@/hooks/use-token-create";
import type { CreateTokenParams, TokenMetadataField } from "@/types/token";

const STEPS = ["Basic Info", "Compliance", "Supply", "Metadata", "Review"];

export interface WizardState {
  basicInfo: BasicInfoData;
  compliance: ComplianceData;
  supply: SupplyData;
  metadata: MetadataData;
}

const DEFAULT_STATE: WizardState = {
  basicInfo: {
    name: "",
    symbol: "",
    decimals: 6,
    description: "",
    assetType: "treasury",
    imageUri: "",
  },
  compliance: {
    enableKycGating: true,
    enableTransferFees: false,
    transferFeeBps: 0,
    transferFeeMax: "",
    enablePause: true,
    enablePermanentDelegate: false,
    enableMemoRequired: false,
  },
  supply: {
    initialSupply: "",
  },
  metadata: {
    fields: [],
    externalUri: "",
    jurisdiction: "",
    regulatoryFramework: "none",
  },
};

export function CreateWizard() {
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { create, isLoading } = useTokenCreate();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);

  const updateStep = useCallback(
    <K extends keyof WizardState>(key: K, data: WizardState[K]) => {
      setState((prev) => ({ ...prev, [key]: data }));
    },
    []
  );

  const canProceed = useCallback((): boolean => {
    if (step === 0) {
      const { name, symbol, decimals } = state.basicInfo;
      return (
        name.trim().length > 0 &&
        /^[A-Z0-9-]{2,10}$/.test(symbol) &&
        decimals >= 0 &&
        decimals <= 9
      );
    }
    return true;
  }, [step, state]);

  const handleCreate = useCallback(async () => {
    if (!publicKey) return;

    const { basicInfo, compliance, supply, metadata } = state;
    const decimals = basicInfo.decimals;
    const multiplier = BigInt(10 ** decimals);

    const initialSupply = supply.initialSupply
      ? BigInt(Math.floor(parseFloat(supply.initialSupply) * Number(multiplier)))
      : undefined;

    const transferFeeMax = compliance.transferFeeMax
      ? BigInt(Math.floor(parseFloat(compliance.transferFeeMax) * Number(multiplier)))
      : BigInt(10 ** decimals) * 1000n;

    const allMetadata: TokenMetadataField[] = [
      { key: "description", value: basicInfo.description },
      { key: "asset_type", value: basicInfo.assetType },
      ...(metadata.jurisdiction
        ? [{ key: "jurisdiction", value: metadata.jurisdiction }]
        : []),
      ...(metadata.regulatoryFramework !== "none"
        ? [{ key: "regulatory_framework", value: metadata.regulatoryFramework }]
        : []),
      ...metadata.fields.filter((f) => f.key && f.value),
    ];

    const params: CreateTokenParams = {
      name: basicInfo.name.trim(),
      symbol: basicInfo.symbol.trim(),
      decimals,
      uri: metadata.externalUri || "",
      description: basicInfo.description,
      assetType: basicInfo.assetType,
      jurisdiction: metadata.jurisdiction,
      regulatoryFramework: metadata.regulatoryFramework as CreateTokenParams["regulatoryFramework"],
      extensions: {
        defaultAccountState: compliance.enableKycGating ? "frozen" : "initialized",
        transferFee: compliance.enableTransferFees
          ? { bps: compliance.transferFeeBps, maxFee: transferFeeMax }
          : undefined,
        pausable: compliance.enablePause,
        permanentDelegate: compliance.enablePermanentDelegate ? publicKey : undefined,
        memoTransfer: compliance.enableMemoRequired,
      },
      initialSupply,
      metadata: allMetadata,
    };

    const result = await create(params);
    if (result) {
      router.push(`/tokens/${result.mint.toBase58()}`);
    }
  }, [publicKey, state, create, router]);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-[#30363d] bg-[#161b22] p-12 text-center">
        <Wallet className="mb-4 size-8 text-[#8b949e]" />
        <p className="text-sm text-[#f0f6fc] mb-2">
          Connect your wallet to create a token
        </p>
        <Button
          onClick={() => setVisible(true)}
          className="gap-2 bg-[#238636] text-white hover:bg-[#2ea043]"
        >
          <Wallet className="size-4" />
          Connect Wallet
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <button
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                i === step
                  ? "bg-[#238636] text-white"
                  : i < step
                    ? "bg-[#21262d] text-[#3fb950] cursor-pointer hover:bg-[#30363d]"
                    : "bg-[#161b22] text-[#8b949e]"
              }`}
            >
              <span className="size-4 flex items-center justify-center rounded-full text-[10px] font-bold border border-current">
                {i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div
                className={`h-px w-4 sm:w-8 ${
                  i < step ? "bg-[#3fb950]" : "bg-[#30363d]"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-6">
        {step === 0 && (
          <BasicInfoStep
            data={state.basicInfo}
            onChange={(d) => updateStep("basicInfo", d)}
          />
        )}
        {step === 1 && (
          <ComplianceStep
            data={state.compliance}
            onChange={(d) => updateStep("compliance", d)}
          />
        )}
        {step === 2 && (
          <SupplyStep
            data={state.supply}
            decimals={state.basicInfo.decimals}
            onChange={(d) => updateStep("supply", d)}
          />
        )}
        {step === 3 && (
          <MetadataStep
            data={state.metadata}
            assetType={state.basicInfo.assetType}
            onChange={(d) => updateStep("metadata", d)}
          />
        )}
        {step === 4 && <ReviewStep state={state} />}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
          className="gap-1 border-[#30363d] bg-[#161b22] text-[#f0f6fc] hover:bg-[#21262d]"
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            size="sm"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed()}
            className="gap-1 bg-[#238636] text-white hover:bg-[#2ea043]"
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={isLoading}
            className="gap-2 bg-[#238636] text-white hover:bg-[#2ea043]"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Token"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
