"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  ShieldCheck,
  Upload,
  Wallet,
} from "lucide-react";
import {
  MarketingNav,
  MarketingFooter,
} from "@/components/landing/marketing-chrome";
import { setKycState, getKycState, type KycFormData } from "@/lib/kyc";
import { useKycStatus } from "@/hooks/use-kyc-status";
import { truncateAddress } from "@/lib/utils/format";

const JURISDICTIONS = [
  "United States",
  "European Union",
  "United Kingdom",
  "Singapore",
  "Switzerland",
  "United Arab Emirates",
  "Canada",
  "Other",
];

const ROLES = [
  "Issuer / fund administrator",
  "Family office",
  "Institutional allocator",
  "Compliance / legal",
  "Engineering",
  "Other",
];

type Step = 0 | 1 | 2;
const STEP_LABELS = ["Account info", "KYC documents", "Wallet binding"];

const PENDING_MS = 4000;

export function SignupFlow() {
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { status, isHydrated } = useKycStatus();

  const [step, setStep] = useState<Step>(0);
  const [phase, setPhase] = useState<"form" | "pending" | "approved">("form");
  const [formData, setFormData] = useState<KycFormData>({
    fullName: "",
    email: "",
    organization: "",
    jurisdiction: "United States",
    role: "Issuer / fund administrator",
  });
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);
  const redirectRef = useRef<number | null>(null);

  // If already approved, bounce to dashboard
  useEffect(() => {
    if (isHydrated && status === "approved") {
      router.replace("/tokens");
    }
  }, [isHydrated, status, router]);

  // If a pending state is already persisted, resume it
  useEffect(() => {
    if (!isHydrated) return;
    const existing = getKycState();
    if (existing.status === "pending") {
      setPhase("pending");
      if (existing.formData) setFormData(existing.formData);
    }
  }, [isHydrated]);

  const handleSubmit = useCallback(() => {
    const submittedAt = Date.now();
    const walletAddress = publicKey?.toBase58();
    const fullForm: KycFormData = {
      ...formData,
      documentName: fileName ?? undefined,
      walletAddress,
    };
    setFormData(fullForm);
    setKycState({
      status: "pending",
      submittedAt,
      formData: fullForm,
    });
    setPhase("pending");

    timerRef.current = window.setTimeout(() => {
      approve(fullForm, submittedAt);
    }, PENDING_MS);
  }, [formData, fileName, publicKey]);

  const approve = useCallback(
    (form: KycFormData, submittedAt: number) => {
      setKycState({
        status: "approved",
        submittedAt,
        approvedAt: Date.now(),
        formData: form,
      });
      setPhase("approved");
      redirectRef.current = window.setTimeout(() => {
        router.push("/tokens");
      }, 2200);
    },
    [router]
  );

  const approveNow = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    const existing = getKycState();
    if (existing.status === "pending" && existing.formData && existing.submittedAt) {
      approve(existing.formData, existing.submittedAt);
    }
  }, [approve]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (redirectRef.current) window.clearTimeout(redirectRef.current);
    };
  }, []);

  const step0Valid =
    formData.fullName.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) &&
    formData.organization.trim().length > 0;
  const step1Valid = true; // optional — user can skip without uploading
  const step2Valid = connected && !!publicKey;

  const canProceed =
    step === 0 ? step0Valid : step === 1 ? step1Valid : step2Valid;

  const handleFile = (file: File) => {
    setFileName(file.name);
  };

  return (
    <div className="bg-[#0a0e13] text-[#f0f6fc] -mt-px min-h-screen flex flex-col">
      <MarketingNav />

      {phase === "pending" && <PendingScreen onApproveNow={approveNow} />}
      {phase === "approved" && <ApprovedScreen formData={formData} />}
      {phase === "form" && (
        <section className="mx-auto w-full max-w-[720px] px-5 md:px-8 pt-8 md:pt-12 pb-12 md:pb-16 flex-1">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[12px] text-[#8b949e] hover:text-[#f0f6fc] mb-5 md:mb-6"
          >
            <ArrowLeft className="size-3.5" />
            Back to overview
          </Link>

          <div className="mb-3 md:mb-4 font-mono text-[10px] md:text-[11px] font-medium uppercase tracking-[0.14em] text-[#3fb950]">
            / apply for access
          </div>
          <h1 className="m-0 mb-3 md:mb-4 text-[28px] md:text-[36px] xl:text-[44px] font-semibold leading-[1.05] tracking-[-0.03em]">
            Institutional onboarding,{" "}
            <span className="text-[#3fb950]">streamlined</span>.
          </h1>
          <p className="m-0 mb-8 md:mb-10 text-[14px] md:text-[15px] leading-[1.6] text-[#8b949e]">
            Three short steps. Your application routes to the counterparty
            desk and your wallet is bound to your identity for audit
            purposes.
          </p>

          <StepIndicator step={step} />

          <div className="mt-6 md:mt-8 rounded-lg border border-[#21262d] bg-[#0d1117] p-5 md:p-8">
            {step === 0 && (
              <Step0
                formData={formData}
                onChange={setFormData}
              />
            )}
            {step === 1 && (
              <Step1
                fileName={fileName}
                onSelectFile={() => fileInputRef.current?.click()}
                onClearFile={() => setFileName(null)}
              />
            )}
            {step === 2 && (
              <Step2
                connected={connected}
                walletAddress={publicKey?.toBase58() ?? null}
                onConnect={() => setVisible(true)}
              />
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />

            <div className="mt-8 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (step === 0) router.push("/");
                  else setStep((step - 1) as Step);
                }}
                className="text-[12px] text-[#8b949e] hover:text-[#f0f6fc] transition-colors inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="size-3.5" />
                {step === 0 ? "Cancel" : "Back"}
              </button>
              {step < 2 ? (
                <button
                  type="button"
                  disabled={!canProceed}
                  onClick={() => setStep((step + 1) as Step)}
                  className="rounded-full bg-[#f0f6fc] text-[#0a0e13] hover:bg-white disabled:bg-[#21262d] disabled:text-[#6e7681] text-[13px] font-medium px-5 py-2.5 transition-colors inline-flex items-center gap-2"
                >
                  Continue
                  <ArrowRight className="size-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!canProceed}
                  onClick={handleSubmit}
                  className="rounded-full bg-[#238636] text-white hover:bg-[#2ea043] disabled:bg-[#21262d] disabled:text-[#6e7681] text-[13px] font-medium px-5 py-2.5 transition-colors inline-flex items-center gap-2"
                >
                  Submit for review
                  <ArrowRight className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          <p className="mt-6 text-[11px] text-[#6e7681] font-mono leading-[1.6]">
            Demo note: this flow simulates institutional KYC. No documents
            are uploaded, no personal data is transmitted. Auto-approval
            runs for demo purposes.
          </p>
        </section>
      )}

      <MarketingFooter />
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
      {STEP_LABELS.map((label, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <div key={label} className="flex items-center gap-2 sm:gap-3">
            <div
              className={`size-6 rounded-full flex items-center justify-center text-[11px] font-mono font-medium transition-colors ${
                active
                  ? "bg-[#3fb950] text-[#0a0e13]"
                  : done
                    ? "bg-[rgba(63,185,80,0.15)] text-[#3fb950]"
                    : "bg-[#161b22] text-[#8b949e] border border-[#30363d]"
              }`}
            >
              {done ? <CheckCircle2 className="size-3.5" /> : i + 1}
            </div>
            <span
              className={`hidden sm:inline text-[12px] font-medium ${active || done ? "text-[#f0f6fc]" : "text-[#6e7681]"}`}
            >
              {label}
            </span>
            {i < STEP_LABELS.length - 1 && (
              <div
                className={`h-px w-4 sm:w-8 ${done ? "bg-[#3fb950]" : "bg-[#30363d]"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Step0({
  formData,
  onChange,
}: {
  formData: KycFormData;
  onChange: (f: KycFormData) => void;
}) {
  const update = <K extends keyof KycFormData>(key: K, value: KycFormData[K]) =>
    onChange({ ...formData, [key]: value });
  return (
    <div className="space-y-5">
      <FieldLabel label="Full legal name">
        <input
          type="text"
          value={formData.fullName}
          onChange={(e) => update("fullName", e.target.value)}
          placeholder="Jane Mitchell"
          className="w-full rounded-md border border-[#30363d] bg-[#0a0e13] px-3 py-2.5 text-[13px] text-[#f0f6fc] placeholder:text-[#484f58] focus:outline-none focus:ring-2 focus:ring-[#238636]/40"
        />
      </FieldLabel>
      <FieldLabel label="Work email">
        <input
          type="email"
          value={formData.email}
          onChange={(e) => update("email", e.target.value)}
          placeholder="jane@asset-manager.com"
          className="w-full rounded-md border border-[#30363d] bg-[#0a0e13] px-3 py-2.5 text-[13px] text-[#f0f6fc] placeholder:text-[#484f58] focus:outline-none focus:ring-2 focus:ring-[#238636]/40"
        />
      </FieldLabel>
      <FieldLabel label="Organization">
        <input
          type="text"
          value={formData.organization}
          onChange={(e) => update("organization", e.target.value)}
          placeholder="Mitchell Capital Partners"
          className="w-full rounded-md border border-[#30363d] bg-[#0a0e13] px-3 py-2.5 text-[13px] text-[#f0f6fc] placeholder:text-[#484f58] focus:outline-none focus:ring-2 focus:ring-[#238636]/40"
        />
      </FieldLabel>
      <div className="grid grid-cols-2 gap-4">
        <FieldLabel label="Primary jurisdiction">
          <select
            value={formData.jurisdiction}
            onChange={(e) => update("jurisdiction", e.target.value)}
            className="w-full rounded-md border border-[#30363d] bg-[#0a0e13] px-3 py-2.5 text-[13px] text-[#f0f6fc] focus:outline-none focus:ring-2 focus:ring-[#238636]/40"
          >
            {JURISDICTIONS.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label="Role">
          <select
            value={formData.role}
            onChange={(e) => update("role", e.target.value)}
            className="w-full rounded-md border border-[#30363d] bg-[#0a0e13] px-3 py-2.5 text-[13px] text-[#f0f6fc] focus:outline-none focus:ring-2 focus:ring-[#238636]/40"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </FieldLabel>
      </div>
    </div>
  );
}

function Step1({
  fileName,
  onSelectFile,
  onClearFile,
}: {
  fileName: string | null;
  onSelectFile: () => void;
  onClearFile: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="m-0 text-[15px] font-semibold text-[#f0f6fc]">
            Upload a verification document
          </h3>
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#8b949e] border border-[#30363d] rounded px-1.5 py-0.5">
            Optional
          </span>
        </div>
        <p className="m-0 text-[12px] text-[#8b949e] leading-[1.6]">
          In production: government-issued ID, company registration, or
          authority letter. For this demo, uploads are optional — continue
          without attaching anything and the review still proceeds.
        </p>
      </div>

      {fileName ? (
        <div className="rounded-lg border border-[#238636]/40 bg-[rgba(35,134,54,0.05)] p-5 flex items-start gap-3">
          <FileText className="size-5 text-[#3fb950] shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium text-[#f0f6fc] font-mono truncate">
                {fileName}
              </span>
              <span className="text-[10px] uppercase tracking-wider font-mono text-[#3fb950]">
                received
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[#8b949e]">
              Queued for compliance review.
            </p>
          </div>
          <button
            type="button"
            onClick={onClearFile}
            className="text-[11px] text-[#8b949e] hover:text-[#f85149] transition-colors"
          >
            Replace
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onSelectFile}
          className="w-full rounded-lg border-2 border-dashed border-[#30363d] hover:border-[#484f58] hover:bg-[rgba(88,166,255,0.03)] bg-[#0a0e13] p-8 flex flex-col items-center gap-2 transition-colors"
        >
          <Upload className="size-5 text-[#8b949e]" />
          <span className="text-[13px] font-medium text-[#f0f6fc]">
            Click to upload a document
          </span>
          <span className="text-[11px] text-[#8b949e]">
            PDF, PNG, or JPG
          </span>
        </button>
      )}
    </div>
  );
}

function Step2({
  connected,
  walletAddress,
  onConnect,
}: {
  connected: boolean;
  walletAddress: string | null;
  onConnect: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="m-0 mb-1 text-[15px] font-semibold text-[#f0f6fc]">
          Bind a wallet to your identity
        </h3>
        <p className="m-0 text-[12px] text-[#8b949e] leading-[1.6]">
          Atlas ties your KYC approval to a specific Solana wallet. All
          compliance actions and audit-log entries reference this address.
          You can rotate later with a new review.
        </p>
      </div>

      {connected && walletAddress ? (
        <div className="rounded-lg border border-[#238636]/40 bg-[rgba(35,134,54,0.05)] p-5 flex items-start gap-3">
          <Wallet className="size-5 text-[#3fb950] shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[12px] text-[#f0f6fc]">
                {truncateAddress(walletAddress)}
              </span>
              <span className="text-[10px] uppercase tracking-wider font-mono text-[#3fb950]">
                bound
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[#8b949e] font-mono break-all">
              {walletAddress}
            </p>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onConnect}
          className="w-full rounded-lg border border-[#30363d] hover:border-[#58a6ff] bg-[#0a0e13] p-5 flex items-center gap-3 transition-colors"
        >
          <Wallet className="size-5 text-[#58a6ff]" />
          <div className="flex-1 text-left">
            <div className="text-[13px] font-medium text-[#f0f6fc]">
              Connect a wallet
            </div>
            <div className="text-[11px] text-[#8b949e]">
              Phantom, Solflare, Backpack
            </div>
          </div>
          <ArrowRight className="size-4 text-[#8b949e]" />
        </button>
      )}
    </div>
  );
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-mono uppercase tracking-[0.1em] text-[#8b949e]">
        {label}
      </span>
      {children}
    </label>
  );
}

function PendingScreen({ onApproveNow }: { onApproveNow: () => void }) {
  return (
    <section className="mx-auto w-full max-w-[560px] px-8 py-24 flex-1 text-center">
      <div className="inline-flex size-16 rounded-full bg-[rgba(210,153,34,0.12)] items-center justify-center mb-8">
        <Loader2 className="size-7 text-[#d29922] animate-spin" />
      </div>
      <div className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[#d29922]">
        / pending review
      </div>
      <h1 className="m-0 mb-4 text-[26px] md:text-[32px] xl:text-[36px] font-semibold leading-[1.1] tracking-[-0.03em]">
        Routing to the counterparty desk.
      </h1>
      <p className="m-0 mb-8 text-[15px] leading-[1.6] text-[#8b949e]">
        In production, most reviews complete within 24–48 hours and a
        compliance officer reaches out by email. For this demo, approval is
        automatic and runs for a few seconds.
      </p>
      <button
        type="button"
        onClick={onApproveNow}
        className="text-[12px] text-[#58a6ff] hover:text-[#79c0ff] font-mono underline underline-offset-4"
      >
        Skip the wait · approve now
      </button>
    </section>
  );
}

function ApprovedScreen({ formData }: { formData: KycFormData }) {
  return (
    <section className="mx-auto w-full max-w-[560px] px-8 py-24 flex-1 text-center">
      <div className="inline-flex size-16 rounded-full bg-[rgba(63,185,80,0.15)] items-center justify-center mb-8">
        <ShieldCheck className="size-8 text-[#3fb950]" />
      </div>
      <div className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[#3fb950]">
        / approved
      </div>
      <h1 className="m-0 mb-4 text-[26px] md:text-[32px] xl:text-[36px] font-semibold leading-[1.1] tracking-[-0.03em]">
        Welcome to Atlas,{" "}
        <span className="text-[#3fb950]">
          {formData.fullName.split(" ")[0] || "operator"}
        </span>
        .
      </h1>
      <p className="m-0 mb-4 text-[15px] leading-[1.6] text-[#8b949e]">
        Your wallet is bound and your organization is cleared to issue
        tokens. Routing you to the dashboard.
      </p>
      <p className="mt-6 text-[11px] text-[#6e7681] font-mono">
        Redirecting to /tokens…
      </p>
    </section>
  );
}
