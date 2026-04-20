"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import {
  MarketingNav,
  MarketingFooter,
} from "@/components/landing/marketing-chrome";
import { useKycStatus } from "@/hooks/use-kyc-status";

export function LandingPage() {
  const router = useRouter();
  const { status } = useKycStatus();

  const handlePrimaryCta = () => {
    if (status === "approved") {
      router.push("/tokens");
    } else {
      router.push("/signup");
    }
  };

  const primaryCtaLabel =
    status === "approved" ? "Go to dashboard" : "Get started";

  return (
    <div className="bg-[#0a0e13] text-[#f0f6fc] -mt-px">
      <MarketingNav />

      {/* ─── Hero ─── */}
      <section className="mx-auto max-w-[1280px] px-5 md:px-8 pt-12 md:pt-20 pb-12 md:pb-16 border-b border-[#21262d]">
        <div className="hidden md:inline-flex items-center gap-2 rounded-full border border-[#30363d] px-[14px] py-[6px] mb-6 md:mb-8 font-mono text-[10px] md:text-[11px] font-medium text-[#8b949e]">
          <span
            className="size-1.5 rounded-full bg-[#3fb950]"
            style={{ boxShadow: "0 0 0 4px rgba(63,185,80,0.15)" }}
          />
          Live on Solana · Base · Avalanche · Ethereum
        </div>

        <h1 className="m-0 mb-5 md:mb-7 max-w-[1100px] text-[40px] md:text-[56px] xl:text-[80px] font-semibold leading-[0.98] md:leading-[0.95] tracking-[-0.035em] md:tracking-[-0.04em]">
          The issuance layer for{" "}
          <span className="text-[#3fb950]">onchain capital markets.</span> <br/>
          Multiple chains, one dashboard.
        </h1>

        <p className="m-0 mb-8 md:mb-10 max-w-[620px] text-[15px] md:text-[17px] xl:text-[19px] leading-[1.55] text-[#8b949e]">
          Atlas is a regulated-first issuance, custody, and distribution
          platform. The same standards BlackRock,
          Franklin Templeton, and other institutions use across $29B in tokenized assets —
          available to any fund manager.
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <button
            onClick={handlePrimaryCta}
            className="rounded-full bg-[#f0f6fc] hover:bg-white text-[#0a0e13] text-[14px] font-medium px-7 py-[14px] transition-colors w-full sm:w-auto"
          >
            {primaryCtaLabel}
          </button>
          <Link
            href="/explorer"
            className="inline-flex items-center justify-center sm:justify-start gap-2 text-[#c9d1d9] hover:text-[#f0f6fc] text-[13px] font-medium px-1 py-[14px] border-b border-[#30363d] hover:border-[#f0f6fc] transition-colors"
          >
            Browse the catalog
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {/* Meta stats */}
        <div className="mt-12 md:mt-16 pt-8 border-t border-[#21262d]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px md:gap-8 bg-[#21262d] md:bg-transparent rounded-lg md:rounded-none overflow-hidden md:overflow-visible">
          <MetaStat
            label={["ON-CHAIN COST", "PER TRANSFER"]}
            value="$0.003"
            sub="vs. $0.50–$50 on L1"
          />
          <MetaStat
            label={["COMPLIANCE", "EXTENSIONS"]}
            value="20"
            sub="natively enforced"
          />
          <MetaStat
            label={["REGULATORY", "FRAMEWORKS"]}
            value="4"
            sub="SEC · MiCA · MAS · VARA"
          />
          <MetaStat
            label={["AUDIT", "PARTNERS"]}
            value="9 audits"
            sub="Trail of Bits · OtterSec · Neodyme · since 2022"
          />
          </div>
        </div>
      </section>

      {/* ─── Four pillars ─── */}
      <section className="mx-auto max-w-[1280px] px-5 md:px-8 py-16 md:py-24 grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-10 md:gap-[72px]">
        <div>
          <div className="mb-4 md:mb-5 font-mono text-[10px] md:text-[11px] font-medium uppercase tracking-[0.14em] text-[#3fb950]">
            / four pillars
          </div>
          <h2 className="m-0 mb-5 md:mb-6 text-[28px] md:text-[32px] xl:text-[40px] font-semibold leading-[1.05] tracking-[-0.03em]">
            Issuance that{" "}
            <span className="text-[#3fb950]">passes</span> a compliance
            review.
          </h2>
          <p className="text-[#8b949e] text-[14px] md:text-[15px] leading-[1.6] m-0">
            Regulated securities require mechanisms that meme tokens
            don&apos;t. Atlas makes every one of them a first-class setting at
            token creation — immutable, auditable, and wallet-visible.
          </p>
        </div>

        <div className="border-b border-[#21262d]">
          <Pillar
            num="01"
            title="Compliance as a token primitive"
            tag="Reg D / S / A+"
          >
            Freeze, thaw, delegate, and transfer hooks — <Verb>enforced</Verb>{" "}
            by the protocol, not bolted-on contracts.
          </Pillar>
          <Pillar
            num="02"
            title="Institutional custody, preserved"
            tag="Fireblocks · Squads · Safe"
          >
            Multisig and MPC custody <Verb>supported</Verb> out of the box.
            Authority rotation is a first-class flow.
          </Pillar>
          <Pillar
            num="03"
            title="Wallet-visible investor protections"
            tag="Phantom · Ledger · MetaMask"
          >
            Every powerful authority surfaces a warning in the holder&apos;s
            wallet. No hidden controls — protection is <Verb>disclosed</Verb>{" "}
            by default.
          </Pillar>
          <Pillar
            num="04"
            title="Secondary-market ready"
            tag="Securitize · tZERO"
          >
            Transfer Hooks <Verb>whitelist</Verb> compliant DEX pools.
            Permissionless venues simply reject the token — by design.
          </Pillar>
          <Pillar
            num="05"
            title="Native yield distributions"
            tag="pro-rata · equal-share"
          >
            Coupon payments, NAV distributions, and fund income{" "}
            <Verb>executed</Verb> on-chain — one confirmation, every holder,
            every chain. Not a fund admin service call.
          </Pillar>
        </div>
      </section>

      {/* ─── Proof point ─── */}
      <section className="mx-auto max-w-[1280px] px-5 md:px-8 py-16 md:py-24 text-center border-t border-b border-[#21262d]">
        <p className="m-0 mx-auto mb-6 md:mb-8 max-w-[860px] text-[22px] md:text-[26px] xl:text-[32px] font-normal leading-[1.3] tracking-[-0.015em] text-[#f0f6fc]">
          Traditional transfer-agent fees for a 10,000-investor fund exceed{" "}
          <span className="text-[#f85149]">$500,000 per year</span>.{" "} 
          Atlas:{" "}
          <span className="text-[#3fb950]">a fraction of that</span>.
        </p>
        <Link
          href="/institutions"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[#8b949e] hover:text-[#f0f6fc] transition-colors"
        >
          See the full breakdown
          <ArrowRight className="size-3" />
        </Link>
      </section>

      {/* ─── Market ─── */}
      <section className="mx-auto max-w-[1280px] px-5 md:px-8 py-16 md:py-24">
        <h2 className="m-0 mb-8 md:mb-12 max-w-[720px] text-[28px] md:text-[32px] xl:text-[40px] font-semibold leading-[1.1] tracking-[-0.03em]">
          <span className="text-[#3fb950]">$29B</span> in tokenized assets.
          Already live. Already institutional.
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[#21262d] border border-[#21262d] rounded-xl overflow-hidden">
          <IssuerCell
            name="BlackRock"
            value="$2.8B"
            note="BUIDL · institutional fund · 6 chains"
          />
          <IssuerCell
            name="Franklin Templeton"
            value="$594M"
            note="BENJI · on-chain money-market"
          />
          <IssuerCell
            name="Ondo Finance"
            value="$1.4B"
            note="OUSG · tokenized treasuries"
          />
          <IssuerCell
            name="+ 40 more"
            value="$25B+"
            note="credit, real estate, commodities"
          />
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

function MetaStat({
  label,
  value,
  sub,
}: {
  label: [string, string];
  value: React.ReactNode;
  sub: string;
}) {
  return (
    <div className="bg-[#0a0e13] p-5 md:p-0 md:bg-transparent text-center md:text-left">
      {/* Eyebrow — always 2 visible lines on mobile, joined inline on desktop */}
      <div className="mb-3 md:mb-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#6e7681] leading-[1.5]">
        {label[0]}
        <span className="hidden md:inline">{"\u00A0"}</span>
        <br className="md:hidden" />
        {label[1]}
      </div>
      {/* Value — primary visible accent */}
      <div className="text-[28px] md:text-[32px] xl:text-[36px] font-semibold tracking-[-0.025em] leading-[1.1]">
        {value}
      </div>
      {/* One sub-headline — reserves 2 lines worth of space so cells stay
          row-aligned even when one sub wraps and another doesn't */}
      <div className="mt-2 md:mt-1.5 min-h-[34px] md:min-h-0 flex items-center justify-center md:justify-start text-[11px] md:text-[12px] text-[#8b949e] text-balance leading-[1.5]">
        {sub}
      </div>
    </div>
  );
}

function Pillar({
  num,
  title,
  tag,
  children,
}: {
  num: string;
  title: string;
  tag: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:grid md:grid-cols-[56px_1fr_auto] md:gap-6 md:items-start py-6 md:py-7 border-t border-[#21262d]">
      <div className="mb-3 md:mb-0 text-[24px] md:text-[28px] font-mono font-semibold text-[#3fb950] leading-none tracking-[-0.02em]">
        {num}
      </div>
      <div>
        <h3 className="m-0 mb-2 text-[17px] md:text-[20px] font-semibold tracking-[-0.01em] text-[#f0f6fc]">
          {title}
        </h3>
        <p className="m-0 max-w-[520px] text-[13px] md:text-[14px] leading-[1.6] text-[#8b949e]">
          {children}
        </p>
      </div>
      <div className="mt-3 md:mt-0 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-[#6e7681] md:whitespace-nowrap">
        {tag}
      </div>
    </div>
  );
}

function Verb({ children }: { children: React.ReactNode }) {
  return <span className="text-[#3fb950] font-medium">{children}</span>;
}

function IssuerCell({
  name,
  value,
  note,
}: {
  name: string;
  value: string;
  note: string;
}) {
  return (
    <div className="bg-[#0a0e13] p-5 md:p-7">
      <div className="text-[14px] md:text-[15px] font-medium mb-1 text-[#f0f6fc]">
        {name}
      </div>
      <div className="my-2.5 md:my-3 text-[26px] md:text-[32px] font-semibold text-[#3fb950] tracking-[-0.03em]">
        {value}
      </div>
      <div className="font-mono text-[10px] md:text-[11px] text-[#8b949e]">
        {note}
      </div>
    </div>
  );
}
