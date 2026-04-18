"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { ArrowRight } from "lucide-react";
import { AtlasLogo, AtlasWordmark } from "@/components/shared/atlas-logo";

const SERIF = "var(--font-caslon), 'Libre Caslon Text', Georgia, serif";

export function LandingPage() {
  const router = useRouter();
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();

  const handlePrimaryCta = () => {
    if (connected) {
      router.push("/tokens");
    } else {
      setVisible(true);
    }
  };

  const primaryCtaLabel = connected ? "Go to dashboard" : "Connect wallet";

  return (
    <div className="bg-[#0a0e13] text-[#f0f6fc] -mt-px">
      {/* ─── Nav ─── */}
      <nav className="mx-auto flex max-w-[1280px] items-center gap-8 px-8 py-7">
        <AtlasWordmark size={26} />
        <div className="hidden md:flex gap-7 text-[13px] font-medium text-[#8b949e]">
          <a className="hover:text-[#f0f6fc] transition-colors cursor-pointer">
            Platform
          </a>
          <a className="hover:text-[#f0f6fc] transition-colors cursor-pointer">
            For institutions
          </a>
          <a className="hover:text-[#f0f6fc] transition-colors cursor-pointer">
            Regulation
          </a>
          <Link
            href="/faq"
            className="hover:text-[#f0f6fc] transition-colors cursor-pointer"
          >
            FAQ
          </Link>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={handlePrimaryCta}
            className="text-[#c9d1d9] hover:text-[#f0f6fc] text-xs font-medium px-4 py-2 transition-colors"
          >
            Sign in
          </button>
          <button
            onClick={handlePrimaryCta}
            className="rounded-full bg-[#f0f6fc] text-[#0a0e13] hover:bg-white text-xs font-medium px-[18px] py-2 transition-colors"
          >
            {connected ? "Go to dashboard" : "Book a walkthrough"}
          </button>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="mx-auto max-w-[1280px] px-8 pt-20 pb-16 border-b border-[#21262d]">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#30363d] px-[14px] py-[6px] mb-8 font-mono text-[11px] font-medium text-[#8b949e]">
          <span
            className="size-1.5 rounded-full bg-[#3fb950]"
            style={{ boxShadow: "0 0 0 4px rgba(63,185,80,0.15)" }}
          />
          Live on Solana · Token-2022 natively regulated
        </div>

        <h1
          className="m-0 mb-7 max-w-[1100px] text-[88px] font-normal"
          style={{
            fontFamily: SERIF,
            lineHeight: 0.98,
            letterSpacing: "-0.035em",
          }}
        >
          The counterparty infrastructure for the{" "}
          <span style={{ color: "#3fb950" }}>next decade</span> of tokenized
          real-world assets.
        </h1>

        <p className="m-0 mb-10 max-w-[620px] text-[19px] leading-[1.55] text-[#8b949e]">
          Atlas is a regulated-first issuance, custody, and distribution
          platform. Built on Solana&apos;s Token-2022 program — the same stack
          BlackRock, Franklin Templeton, and Ondo use to move over a billion
          dollars on-chain.
        </p>

        <div className="flex items-center gap-4">
          <button
            onClick={handlePrimaryCta}
            className="rounded-full bg-[#f0f6fc] hover:bg-white text-[#0a0e13] text-[14px] font-medium px-7 py-[14px] transition-colors"
          >
            {primaryCtaLabel}
          </button>
          <Link
            href="/explorer"
            className="inline-flex items-center gap-2 text-[#c9d1d9] hover:text-[#f0f6fc] text-[13px] font-medium px-1 py-[14px] border-b border-[#30363d] hover:border-[#f0f6fc] transition-colors"
          >
            Browse the catalog
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {/* Meta stats */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 pt-8 border-t border-[#21262d]">
          <MetaStat
            label="Per-transfer cost"
            value="$0.003"
            cap="vs. $0.50–$50 on Ethereum L1"
          />
          <MetaStat
            label="Compliance extensions"
            value={
              <>
                20<span className="text-[14px] text-[#8b949e] font-medium font-sans ml-1.5">natively enforced</span>
              </>
            }
            cap="No 6-contract ERC-3643 stack"
          />
          <MetaStat
            label="Regulatory frameworks"
            value={
              <>
                4<span className="text-[14px] text-[#8b949e] font-medium font-sans ml-1.5">jurisdictions</span>
              </>
            }
            cap="SEC · MiCA · MAS · VARA"
          />
          <MetaStat
            label="Audit partners"
            value={
              <>
                Neodyme<span className="text-[14px] text-[#8b949e] font-medium font-sans ml-1.5">+ 3 more</span>
              </>
            }
            cap="In production since 2023"
          />
        </div>
      </section>

      {/* ─── Four pillars ─── */}
      <section className="mx-auto max-w-[1280px] px-8 py-24 grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-18 md:gap-[72px]">
        <div>
          <div className="mb-5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[#3fb950]">
            / four pillars
          </div>
          <h2
            className="m-0 mb-6 text-[44px] font-normal"
            style={{
              fontFamily: SERIF,
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
            }}
          >
            Issuance that{" "}
            <span style={{ color: "#3fb950" }}>passes</span> a counterparty
            review.
          </h2>
          <p className="text-[#8b949e] text-[15px] leading-[1.6] m-0">
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
            tag="Fireblocks · Squads"
          >
            Multisig and MPC custody <Verb>supported</Verb> out of the box.
            Authority rotation is a first-class flow.
          </Pillar>
          <Pillar
            num="03"
            title="Wallet-visible investor protections"
            tag="Phantom · Ledger"
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
        </div>
      </section>

      {/* ─── Pull quote ─── */}
      <section className="mx-auto max-w-[1280px] px-8 py-24 text-center border-t border-b border-[#21262d]">
        <blockquote className="m-0 mx-auto mb-8 max-w-[860px] text-[32px] font-normal leading-[1.3] tracking-[-0.015em] text-[#f0f6fc]">
          &ldquo;We evaluated six chains and four issuance stacks. Atlas was
          the only one where our compliance team said{" "}
          <span style={{ color: "#3fb950" }}>yes</span> on the first
          review.&rdquo;
        </blockquote>
        <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[#8b949e]">
          — <span className="text-[#c9d1d9]">Head of digital assets</span> ·
          top-20 US asset manager
        </div>
      </section>

      {/* ─── Market ─── */}
      <section className="mx-auto max-w-[1280px] px-8 py-24">
        <h2
          className="m-0 mb-12 max-w-[720px] text-[40px] font-normal"
          style={{
            fontFamily: SERIF,
            letterSpacing: "-0.025em",
            lineHeight: 1.1,
          }}
        >
          The tokenized RWA market is{" "}
          <span style={{ color: "#3fb950" }}>already</span> on Solana.
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[#21262d] border border-[#21262d] rounded-xl overflow-hidden">
          <IssuerCell
            name="Franklin Templeton"
            value="$594M"
            note="BENJI · on-chain money-market"
          />
          <IssuerCell
            name="BlackRock"
            value="$255M"
            note="BUIDL · institutional liquidity fund"
          />
          <IssuerCell
            name="Ondo Finance"
            value="$176M"
            note="OUSG · tokenized treasuries"
          />
          <IssuerCell
            name="+ 14 more"
            value="$180M"
            note="credit, private equity, commodities"
          />
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-[#21262d] py-12">
        <div className="mx-auto max-w-[1280px] px-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-[12px] text-[#6e7681]">
          <div className="flex items-center gap-3">
            <AtlasLogo size={20} />
            <span className="text-[#f0f6fc] font-semibold text-[14px] tracking-tight inline-flex items-baseline">
              <span className="font-mono text-[10px] font-medium tracking-[0.12em] text-[#8b949e] uppercase pr-2 mr-2 border-r border-[#30363d]">
                CPX
              </span>
              Atlas
            </span>
          </div>
          <div>
            © 2026 Cipherion Systems · Token-2022 platform · all amounts
            verifiable on-chain
          </div>
        </div>
      </footer>
    </div>
  );
}

function MetaStat({
  label,
  value,
  cap,
}: {
  label: string;
  value: React.ReactNode;
  cap: string;
}) {
  return (
    <div>
      <div className="mb-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#6e7681]">
        {label}
      </div>
      <div
        className="text-[32px] font-medium"
        style={{
          fontFamily: SERIF,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[12px] text-[#8b949e]">{cap}</div>
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
    <div className="grid grid-cols-[56px_1fr_auto] gap-6 items-start py-7 border-t border-[#21262d]">
      <div
        className="text-[32px] font-medium text-[#3fb950] leading-none"
        style={{ fontFamily: SERIF }}
      >
        {num}
      </div>
      <div>
        <h3 className="m-0 mb-2 text-[20px] font-semibold tracking-[-0.01em] text-[#f0f6fc]">
          {title}
        </h3>
        <p className="m-0 max-w-[520px] text-[14px] leading-[1.6] text-[#8b949e]">
          {children}
        </p>
      </div>
      <div className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-[#6e7681] whitespace-nowrap">
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
    <div className="bg-[#0a0e13] p-7">
      <div
        className="text-[18px] font-medium mb-1"
        style={{ fontFamily: SERIF }}
      >
        {name}
      </div>
      <div
        className="my-3 text-[36px] font-medium text-[#3fb950]"
        style={{ fontFamily: SERIF, letterSpacing: "-0.02em" }}
      >
        {value}
      </div>
      <div className="font-mono text-[11px] text-[#8b949e]">{note}</div>
    </div>
  );
}
