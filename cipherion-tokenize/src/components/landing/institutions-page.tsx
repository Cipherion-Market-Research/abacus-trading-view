"use client";

import { useRouter } from "next/navigation";
import {
  Shield,
  Building2,
  KeyRound,
  LineChart,
  ArrowRight,
} from "lucide-react";
import {
  MarketingNav,
  MarketingFooter,
} from "@/components/landing/marketing-chrome";
import { useKycStatus } from "@/hooks/use-kyc-status";

export function InstitutionsPage() {
  const router = useRouter();
  const { status } = useKycStatus();

  const handleApply = () => {
    if (status === "approved") router.push("/tokens");
    else router.push("/signup");
  };

  return (
    <div className="bg-[#0a0e13] text-[#f0f6fc] -mt-px min-h-screen">
      <MarketingNav />

      {/* ─── Hero ─── */}
      <section className="mx-auto max-w-[1280px] px-5 md:px-8 pt-10 md:pt-16 pb-10 md:pb-14 border-b border-[#21262d]">
        <div className="mb-4 md:mb-5 font-mono text-[10px] md:text-[11px] font-medium uppercase tracking-[0.14em] text-[#3fb950]">
          / for institutions
        </div>
        <h1 className="m-0 mb-5 md:mb-6 max-w-[960px] text-[36px] md:text-[52px] xl:text-[68px] font-semibold leading-[1.0] md:leading-[0.98] tracking-[-0.035em]">
          Purpose-built for the issuers{" "}
          <span className="text-[#3fb950]">regulators</span> will ask about.
        </h1>
        <p className="m-0 max-w-[620px] text-[15px] md:text-[17px] xl:text-[18px] leading-[1.55] text-[#8b949e]">
          Atlas is the counterparty-grade issuance and custody layer on
          Solana. Same Token-2022 stack used by Franklin Templeton, BlackRock,
          and Ondo — exposed as an institutional operator cockpit.
        </p>
      </section>

      {/* ─── Why institutional buyers pick Atlas ─── */}
      <section className="mx-auto max-w-[1280px] px-5 md:px-8 py-14 md:py-20 grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-10 md:gap-[72px]">
        <div>
          <div className="mb-4 md:mb-5 font-mono text-[10px] md:text-[11px] font-medium uppercase tracking-[0.14em] text-[#3fb950]">
            / differentiators
          </div>
          <h2 className="m-0 mb-5 md:mb-6 text-[28px] md:text-[32px] xl:text-[40px] font-semibold leading-[1.05] tracking-[-0.03em]">
            Why a compliance team says{" "}
            <span className="text-[#3fb950]">yes</span>.
          </h2>
          <p className="text-[#8b949e] text-[14px] md:text-[15px] leading-[1.6]">
            Regulated issuance needs mechanics retail platforms don&apos;t
            expose. Atlas makes each one a first-class setting — immutable,
            auditable, wallet-visible.
          </p>
        </div>

        <div className="border-b border-[#21262d]">
          <Row
            icon={Shield}
            title="Compliance enforced by the protocol"
            sub="Reg D / S / A+"
          >
            Freeze, thaw, permanent delegate, transfer hooks —{" "}
            <Verb>enforced</Verb> by Token-2022 itself, not bolted-on smart
            contracts.
          </Row>
          <Row
            icon={KeyRound}
            title="Institutional custody, preserved"
            sub="Fireblocks · Squads · Anchorage"
          >
            Multisig and MPC custody <Verb>supported</Verb> out of the box.
            Single-key deployments exist but aren&apos;t recommended for
            production. Authority rotation is a first-class flow.
          </Row>
          <Row
            icon={Building2}
            title="Wallet-visible investor protections"
            sub="Phantom · Ledger · Solflare"
          >
            Every powerful authority <Verb>surfaces</Verb> a warning in the
            holder&apos;s wallet. No hidden controls — disclosure by default.
          </Row>
          <Row
            icon={LineChart}
            title="Secondary-market ready"
            sub="Securitize · tZERO · compliant AMMs"
          >
            Transfer Hooks <Verb>whitelist</Verb> compliant DEX pools.
            Permissionless venues reject the token — by design.
          </Row>
        </div>
      </section>

      {/* ─── Cost at scale ─── */}
      <section className="mx-auto max-w-[1280px] px-5 md:px-8 py-14 md:py-20 border-t border-[#21262d]">
        <div className="mb-4 md:mb-5 font-mono text-[10px] md:text-[11px] font-medium uppercase tracking-[0.14em] text-[#3fb950]">
          / economics
        </div>
        <h2 className="m-0 mb-8 md:mb-12 max-w-[820px] text-[28px] md:text-[32px] xl:text-[40px] font-semibold leading-[1.1] tracking-[-0.03em]">
          Year-one infrastructure cost, at scale.
        </h2>

        {/* Desktop / tablet: 4-column table */}
        <div className="hidden sm:block overflow-hidden rounded-xl border border-[#21262d]">
          <div className="grid grid-cols-4 bg-[#0d1117] border-b border-[#21262d] text-[10px] uppercase tracking-[0.12em] font-mono text-[#6e7681]">
            <ThCell>Scale</ThCell>
            <ThCell>On-chain cost</ThCell>
            <ThCell>RPC infra</ThCell>
            <ThCell>Total year 1</ThCell>
          </div>
          <TrCell a="10 investors · demo" b="~$3" c="Free" d="~$3" dAccent />
          <TrCell
            a="100 investors · pilot"
            b="~$110"
            c="$49 / mo"
            d="~$700"
            dAccent
          />
          <TrCell
            a="1,000 investors"
            b="~$450"
            c="$49 / mo"
            d="~$1,035"
            dAccent
          />
          <TrCell
            a="10,000 investors"
            b="~$2,440"
            c="$499 / mo"
            d="~$8,430"
            dAccent
            last
          />
        </div>

        {/* Mobile: card-per-scale stack */}
        <div className="sm:hidden space-y-3">
          <CostCard
            scale="10 investors · demo"
            onchain="~$3"
            rpc="Free"
            total="~$3"
          />
          <CostCard
            scale="100 investors · pilot"
            onchain="~$110"
            rpc="$49 / mo"
            total="~$700"
          />
          <CostCard
            scale="1,000 investors"
            onchain="~$450"
            rpc="$49 / mo"
            total="~$1,035"
          />
          <CostCard
            scale="10,000 investors"
            onchain="~$2,440"
            rpc="$499 / mo"
            total="~$8,430"
          />
        </div>

        <p className="mt-4 text-[11px] md:text-[12px] text-[#6e7681]">
          Traditional transfer-agent and registrar fees for a 10,000-investor
          fund exceed $500,000 per year.
        </p>
      </section>

      {/* ─── CTA ─── */}
      <section className="mx-auto max-w-[1280px] px-5 md:px-8 py-16 md:py-24 border-t border-[#21262d] text-center">
        <h2 className="m-0 mb-4 md:mb-5 text-[28px] md:text-[32px] xl:text-[40px] font-semibold leading-[1.1] tracking-[-0.03em]">
          Ready for a counterparty review?
        </h2>
        <p className="m-0 mb-6 md:mb-8 mx-auto max-w-[560px] text-[#8b949e] text-[14px] md:text-[15px] leading-[1.6]">
          Every Atlas onboarding starts with a 30-minute walkthrough. We
          cover your mandate, custody posture, and regulatory framework
          before any token gets minted.
        </p>
        <button
          onClick={handleApply}
          className="rounded-full bg-[#f0f6fc] text-[#0a0e13] hover:bg-white text-[14px] font-medium px-7 py-[14px] transition-colors inline-flex items-center gap-2"
        >
          {status === "approved" ? "Go to dashboard" : "Apply for access"}
          <ArrowRight className="size-3.5" />
        </button>
      </section>

      <MarketingFooter />
    </div>
  );
}

function Row({
  icon: Icon,
  title,
  sub,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:grid md:grid-cols-[40px_1fr_auto] md:gap-6 md:items-start py-6 md:py-7 border-t border-[#21262d]">
      <div className="mb-3 md:mb-0 size-8 rounded-md bg-[rgba(63,185,80,0.1)] text-[#3fb950] flex items-center justify-center">
        <Icon className="size-4" />
      </div>
      <div>
        <h3 className="m-0 mb-2 text-[17px] md:text-[20px] font-semibold tracking-[-0.01em] text-[#f0f6fc]">
          {title}
        </h3>
        <p className="m-0 max-w-[560px] text-[13px] md:text-[14px] leading-[1.6] text-[#8b949e]">
          {children}
        </p>
      </div>
      <div className="mt-3 md:mt-0 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-[#6e7681] md:whitespace-nowrap">
        {sub}
      </div>
    </div>
  );
}

function CostCard({
  scale,
  onchain,
  rpc,
  total,
}: {
  scale: string;
  onchain: string;
  rpc: string;
  total: string;
}) {
  return (
    <div className="rounded-lg border border-[#21262d] bg-[#0d1117] p-4">
      <div className="text-[14px] font-medium text-[#f0f6fc] mb-3">{scale}</div>
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <Cell label="On-chain" value={onchain} />
        <Cell label="RPC" value={rpc} />
        <Cell label="Year 1" value={total} accent />
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="mb-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[#6e7681]">
        {label}
      </div>
      <div
        className={`font-mono text-[13px] font-medium ${accent ? "text-[#3fb950]" : "text-[#c9d1d9]"}`}
      >
        {value}
      </div>
    </div>
  );
}

function Verb({ children }: { children: React.ReactNode }) {
  return <span className="text-[#3fb950] font-medium">{children}</span>;
}

function ThCell({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-3.5">{children}</div>;
}

function TrCell({
  a,
  b,
  c,
  d,
  dAccent,
  last,
}: {
  a: string;
  b: string;
  c: string;
  d: string;
  dAccent?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-4 bg-[#0a0e13] text-[13px] ${last ? "" : "border-b border-[#21262d]"}`}
    >
      <div className="px-5 py-4 text-[#f0f6fc]">{a}</div>
      <div className="px-5 py-4 font-mono text-[#c9d1d9]">{b}</div>
      <div className="px-5 py-4 font-mono text-[#c9d1d9]">{c}</div>
      <div
        className={`px-5 py-4 font-mono font-medium ${dAccent ? "text-[#3fb950]" : "text-[#f0f6fc]"}`}
      >
        {d}
      </div>
    </div>
  );
}
