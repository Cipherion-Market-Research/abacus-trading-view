"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Building2,
  TrendingUp,
  Shield,
  Code2,
  ArrowRight,
} from "lucide-react";
import {
  MarketingNav,
  MarketingFooter,
} from "@/components/landing/marketing-chrome";

type PersonaKey = "issuer" | "investor" | "compliance" | "technical";

interface Persona {
  key: PersonaKey;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  tint: string;
  asideTitle: string;
  asideSub: string;
  ctas: { label: string; href: string }[];
}

interface FAQItem {
  q: string;
  a: React.ReactNode;
}

const PERSONAS: Persona[] = [
  {
    key: "issuer",
    title: "Issuers",
    subtitle: "Launching a tokenized asset",
    icon: Building2,
    color: "#3fb950",
    tint: "rgba(63,185,80,0.10)",
    asideTitle: "For issuers",
    asideSub: "Most-asked · counterparty pre-call",
    ctas: [
      { label: "Book a 30-min walkthrough", href: "#" },
      { label: "Launch your first token", href: "/create" },
    ],
  },
  {
    key: "investor",
    title: "Investors",
    subtitle: "Receiving, holding, exiting",
    icon: TrendingUp,
    color: "#58a6ff",
    tint: "rgba(88,166,255,0.10)",
    asideTitle: "For investors",
    asideSub: "Onboarding & exit paths",
    ctas: [
      { label: "Browse the catalog", href: "/explorer" },
      { label: "View your portfolio", href: "/portfolio" },
    ],
  },
  {
    key: "compliance",
    title: "Compliance",
    subtitle: "Controls, KYC, regulation",
    icon: Shield,
    color: "#d29922",
    tint: "rgba(210,153,34,0.12)",
    asideTitle: "For compliance",
    asideSub: "On-chain enforcement",
    ctas: [
      { label: "Read the platform brief", href: "#" },
      { label: "Contact compliance team", href: "#" },
    ],
  },
  {
    key: "technical",
    title: "Technical",
    subtitle: "Architecture, Solana, audits",
    icon: Code2,
    color: "#a371f7",
    tint: "rgba(163,113,247,0.10)",
    asideTitle: "For engineers",
    asideSub: "Architecture & integration",
    ctas: [
      { label: "Read the technical proposal", href: "#" },
      { label: "View the SDK reference", href: "#" },
    ],
  },
];

const FAQS: Record<PersonaKey, FAQItem[]> = {
  issuer: [
    {
      q: "How much does it cost to launch a token?",
      a: (
        <p>
          Under <Money>$1</Money> in on-chain costs. The mint account with full
          compliance extensions costs about <Money>$0.63</Money> in rent
          deposit (refundable if the token is ever closed). A custom Transfer
          Hook program is a one-time <Money>$45–$134</Money> deploy.
        </p>
      ),
    },
    {
      q: "What parameters can I configure at creation?",
      a: (
        <p>
          Identity (name, symbol, decimals, image), compliance (KYC gating,
          transfer fees, pausable, permanent delegate, memo required), supply
          (initial mint, no hard cap), authorities (mint, freeze, update), and
          metadata (jurisdiction, framework, NAV, maturity, custodian, ISIN).
        </p>
      ),
    },
    {
      q: "Can I change compliance rules after creation?",
      a: (
        <p>
          Extensions are <strong>immutable</strong> by design — investors get
          certainty about the rules they&apos;re buying into. Supply, metadata,
          and authority assignment can change. Authorities can be rotated or
          revoked at any time.
        </p>
      ),
    },
    {
      q: "Can Atlas be white-labeled?",
      a: (
        <p>
          Yes. Atlas is a Next.js app with a configurable design system —
          branding, colors, logos, and domain are customizable. Programmatic
          API access is on the Phase 2 roadmap.
        </p>
      ),
    },
    {
      q: "What happens if I lose access to my authority wallet?",
      a: (
        <p>
          Use Squads multisig or Fireblocks institutional custody for authority
          wallets. A lost single-key wallet means mint, freeze, and update
          authorities are permanently inaccessible — existing tokens continue
          to function, but no one can mint, freeze, or update metadata.
        </p>
      ),
    },
    {
      q: "How do I run a coupon distribution?",
      a: (
        <p>
          Open the <strong>Distributions</strong> tab on a token dashboard,
          choose a method (pro-rata for ongoing yield, equal-share for
          initial allocation), enter a total amount and memo, then preview
          per-holder allocations before confirming. Atlas executes one
          on-chain mint per recipient — same mint-to-holder mechanic
          BlackRock BUIDL uses. History is persisted per token.
        </p>
      ),
    },
  ],
  investor: [
    {
      q: "How do I receive tokens?",
      a: (
        <p>
          The issuer onboards you by entering your Solana wallet address. Atlas
          creates a token account and approves (thaws) it. Tokens appear in
          Phantom or Solflare and on the Atlas portfolio page.
        </p>
      ),
    },
    {
      q: "Which wallets support Token-2022?",
      a: (
        <p>
          Full support: Phantom, Solflare, Backpack, Ledger (via Phantom or
          Solflare with blind signing), Fireblocks, Squads Multisig. Trust
          Wallet support is unconfirmed. Centralized exchange deposits are not
          broadly supported — don&apos;t send to Coinbase or Binance addresses.
        </p>
      ),
    },
    {
      q: "How do I sell or exit my position?",
      a: (
        <p>
          Four paths, in order of availability: private OTC transfer (today),
          issuer redemption (Phase 2), regulated secondary-market listing
          (Securitize Markets, tZERO), and compliant AMM pool with Transfer
          Hook whitelisting (Phase 2+).
        </p>
      ),
    },
    {
      q: "Can I trade on Jupiter or Raydium?",
      a: (
        <p>
          Not permissionlessly. RWA tokens use{" "}
          <code className="font-mono text-[11px] bg-[#161b22] border border-[#21262d] rounded px-1.5 py-0.5">
            DefaultAccountState=Frozen
          </code>{" "}
          — a DEX pool account would start frozen and need explicit issuer
          approval. With a Transfer Hook, the issuer can whitelist specific
          pools for compliant on-chain trading.
        </p>
      ),
    },
    {
      q: "Can I use RWA tokens as collateral?",
      a: (
        <p>
          Conceptually yes — Flux Finance already does this for OUSG. The key
          challenge is liquidation: defaulted collateral can only be sold to
          approved investors, requiring pre-approved liquidators or an issuer
          backstop.
        </p>
      ),
    },
    {
      q: "Can I see yield accrue in real time?",
      a: (
        <p>
          Yes. Every yield-bearing token displays a live ticker at the top of
          its detail page showing the APY and the amount accrued today,
          updating every second. The ticker reads the <code className="font-mono text-[11px] bg-[#161b22] border border-[#21262d] rounded px-1.5 py-0.5">coupon_rate</code>{" "}
          from on-chain metadata — same data the issuer publishes when the
          token is minted. Same mechanic Franklin Templeton shipped on BENJI
          in 2025.
        </p>
      ),
    },
    {
      q: "When and how do I receive yield?",
      a: (
        <p>
          The issuer initiates a distribution from the Distributions tab on
          the token dashboard. Atlas mints new tokens directly into your
          wallet, pro-rata to your share of circulating supply — no claim
          step. Same mechanic BlackRock BUIDL uses for monthly coupons.
          You&apos;ll see your balance grow on the next block, with the memo
          (e.g., &quot;Q3-26 coupon distribution&quot;) recorded on-chain.
        </p>
      ),
    },
  ],
  compliance: [
    {
      q: "Can the issuer freeze my account?",
      a: (
        <p>
          Yes. The freeze authority can freeze any token account. Used for
          suspicious-activity review, regulatory hold, court order, or KYC
          expiry. The issuer can thaw to restore normal operation.
        </p>
      ),
    },
    {
      q: "Can the issuer seize tokens?",
      a: (
        <p>
          Only if the Permanent Delegate extension was enabled at token
          creation. Used for court orders, sanctions, forced redemption, or
          estate settlement. Wallets display a warning badge to holders when
          this extension is active.
        </p>
      ),
    },
    {
      q: "Is KYC real or simulated?",
      a: (
        <p>
          MVP: simulated — the issuer manually thaws approved accounts.
          Production: KYC-provider integration (Civic Pass, Synaps, Persona)
          issuing on-chain credentials. Same enforcement mechanism either way:
          frozen → active.
        </p>
      ),
    },
    {
      q: "Are these compliance features standard?",
      a: (
        <p>
          Yes. Every major RWA platform implements freeze, pause, KYC gating,
          and forced-transfer capabilities. Required by SEC (Reg D / S / A+),
          MiCA (EU), MAS (Singapore), VARA (Dubai). Platforms without these
          cannot be used for regulated securities offerings.
        </p>
      ),
    },
    {
      q: "Can this token end up on pump.fun or meme-coin exchanges?",
      a: (
        <p>
          No. Every transfer requires the recipient to have an approved
          (thawed) token account, which only the issuer can create.
          Permissionless exchanges can&apos;t create these accounts — the
          protocol physically prevents it.
        </p>
      ),
    },
  ],
  technical: [
    {
      q: "Why Solana over Ethereum?",
      a: (
        <p>
          Cost (~<Money>$0.003</Money> per transfer vs. <Money>$0.50–$50</Money>{" "}
          on L1), native compliance (Token-2022 extensions vs. a 6-contract
          ERC-3643 stack), and institutional adoption — Franklin Templeton
          ($594M), BlackRock ($255M), and Ondo ($176M) all run on Solana as of
          2026.
        </p>
      ),
    },
    {
      q: "What is Token-2022?",
      a: (
        <p>
          Solana&apos;s current-generation token program with 20+ configurable
          extensions. Same program ID on Devnet, Testnet, and Mainnet. The
          &ldquo;2022&rdquo; is a design year, not a version — this is the
          production program.
        </p>
      ),
    },
    {
      q: "Does Atlas require a backend?",
      a: (
        <p>
          Not for the MVP. Transactions are built in the browser and signed by
          the user&apos;s wallet; state is read from RPC. Production features
          (automated distributions, KYC providers, audit-log persistence) use
          a lightweight Next.js API backend.
        </p>
      ),
    },
    {
      q: "Has Token-2022 been audited?",
      a: (
        <p>
          Yes — audited by multiple firms including Neodyme. Open source,
          verifiable on-chain, in production since 2023 with billions in value
          secured.
        </p>
      ),
    },
    {
      q: "What happens if Solana goes down?",
      a: (
        <p>
          During an outage no transactions process — state is preserved and
          resumes on recovery. For time-sensitive operations (redemptions,
          distributions), issuers should have contingency procedures. Uptime
          has improved significantly since 2023; the Alpenglow upgrade (late
          2026) further stabilizes consensus.
        </p>
      ),
    },
    {
      q: "How does Atlas distribute yield on-chain?",
      a: (
        <p>
          Mint-to-holder pro-rata, matching the BlackRock BUIDL mechanic.
          The issuer specifies a total amount; Atlas computes per-holder
          allocation as <code className="font-mono text-[11px] bg-[#161b22] border border-[#21262d] rounded px-1.5 py-0.5">
            (holderBalance / circulatingSupply) × totalAmount
          </code>{" "}
          (excluding treasury and frozen accounts), then executes one{" "}
          <code className="font-mono text-[11px] bg-[#161b22] border border-[#21262d] rounded px-1.5 py-0.5">
            mintTo
          </code>{" "}
          instruction per recipient with the memo embedded. Each transaction
          is signed by the issuer&apos;s mint authority. Per-recipient cost
          is ~$0.003.
        </p>
      ),
    },
  ],
};

function Money({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[#f0f6fc] font-medium">{children}</span>
  );
}

export function FaqPage() {
  const [activeKey, setActiveKey] = useState<PersonaKey>("issuer");
  const [openIndex, setOpenIndex] = useState<number>(0);

  const activePersona = useMemo(
    () => PERSONAS.find((p) => p.key === activeKey)!,
    [activeKey]
  );
  const items = FAQS[activeKey];

  return (
    <div className="bg-[#0a0e13] text-[#f0f6fc] -mt-px min-h-screen">
      <MarketingNav />

      {/* ─── Page intro ─── */}
      <section className="mx-auto max-w-[1280px] px-5 md:px-8 pt-10 md:pt-12 pb-10 md:pb-12 border-b border-[#21262d]">
        <div className="mb-4 md:mb-5 font-mono text-[10px] md:text-[11px] font-medium uppercase tracking-[0.14em] text-[#3fb950]">
          / questions, by audience
        </div>
        <h1 className="m-0 mb-4 md:mb-5 max-w-[860px] text-[32px] md:text-[44px] xl:text-[60px] font-semibold leading-[1.02] tracking-[-0.035em]">
          Pick your role. Read what&apos;s{" "}
          <span className="text-[#3fb950]">relevant</span>.
        </h1>
        <p className="m-0 max-w-[620px] text-[14px] md:text-[16px] xl:text-[17px] leading-[1.55] text-[#8b949e]">
          Issuers, investors, compliance officers, and engineers each see a
          different surface of Atlas. Pick yours and see the questions tuned to
          your decisions.
        </p>
      </section>

      {/* ─── Persona bar + body ─── */}
      <section className="mx-auto max-w-[1280px] px-5 md:px-8 py-10 md:py-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#21262d] border border-[#21262d] rounded-xl overflow-hidden mb-6 md:mb-8">
          {PERSONAS.map((p) => {
            const Icon = p.icon;
            const active = p.key === activeKey;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setActiveKey(p.key);
                  setOpenIndex(0);
                }}
                aria-pressed={active}
                className="relative flex flex-col gap-1.5 p-[18px] text-left transition-colors bg-[#0a0e13] hover:bg-[#161b22] aria-pressed:bg-[#161b22]"
              >
                <div
                  className="size-7 rounded-md flex items-center justify-center mb-1"
                  style={{
                    background: active ? p.tint : "rgba(139,148,158,0.06)",
                    color: active ? p.color : "#8b949e",
                    transition: "all 120ms",
                  }}
                >
                  <Icon className="size-4" />
                </div>
                <span className="text-[13px] font-semibold text-[#f0f6fc]">
                  {p.title}
                </span>
                <span className="text-[11px] text-[#8b949e]">{p.subtitle}</span>
                <span className="absolute top-3 right-3.5 font-mono text-[10px] font-medium text-[#6e7681]">
                  {FAQS[p.key].length}
                </span>
                {active && (
                  <span
                    className="absolute left-0 right-0 bottom-0 h-0.5"
                    style={{ background: p.color }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-10 items-start">
          {/* Accordion */}
          <div>
            <div className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[#8b949e]">
              {items.length} questions for {activePersona.title.toLowerCase()}
            </div>
            <div className="border-t border-[#21262d]">
              {items.map((item, i) => {
                const open = i === openIndex;
                return (
                  <button
                    key={`${activeKey}-${i}`}
                    type="button"
                    onClick={() => setOpenIndex(open ? -1 : i)}
                    className="block w-full text-left grid grid-cols-[20px_1fr] gap-3.5 py-4 border-b border-[#21262d] hover:bg-[rgba(22,27,34,0.4)] transition-colors"
                  >
                    <ChevronRight
                      className="size-4 mt-0.5 transition-transform"
                      style={{
                        color: open ? activePersona.color : "#6e7681",
                        transform: open ? "rotate(90deg)" : "rotate(0deg)",
                      }}
                    />
                    <div>
                      <div className="text-[15px] font-medium text-[#f0f6fc]">
                        {item.q}
                      </div>
                      {open && (
                        <div className="mt-3 text-[14px] leading-[1.65] text-[#c9d1d9]">
                          {item.a}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sidebar */}
          <aside
            className="rounded-lg border border-[#21262d] bg-[#0d1117] p-5 lg:sticky lg:top-6"
            style={{ borderColor: activePersona.tint.replace("0.10", "0.25").replace("0.12", "0.25") }}
          >
            {/* Desktop header: persona label + subtitle */}
            <div className="hidden lg:block">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="size-2 rounded-sm"
                  style={{ background: activePersona.color }}
                />
                <h4 className="m-0 text-[13px] font-semibold text-[#f0f6fc]">
                  {activePersona.asideTitle}
                </h4>
              </div>
              <div className="font-mono text-[11px] text-[#8b949e] mb-4">
                {activePersona.asideSub}
              </div>
              <ul className="m-0 p-0 list-none">
                {items.map((item, i) => (
                  <li
                    key={`aside-${activeKey}-${i}`}
                    className="py-2 border-t border-[#21262d] first:border-t-0"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenIndex(i)}
                      className="text-left text-[12px] text-[#c9d1d9] hover:text-[#f0f6fc] transition-colors w-full"
                    >
                      <span className="font-mono text-[10px] text-[#6e7681] mr-2">
                        Q{i + 1}
                      </span>
                      {item.q}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Mobile header: CTA prompt only */}
            <div className="lg:hidden">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="size-2 rounded-sm"
                  style={{ background: activePersona.color }}
                />
                <h4 className="m-0 text-[14px] font-semibold text-[#f0f6fc]">
                  Didn&apos;t find your answer?
                </h4>
              </div>
              <p className="m-0 text-[13px] leading-[1.55] text-[#8b949e]">
                Jump into the platform or talk to the counterparty desk.
              </p>
            </div>

            <div className="mt-4 lg:pt-4 lg:border-t lg:border-[#21262d] flex flex-col gap-2.5">
              {activePersona.ctas.map((cta) => (
                <Link
                  key={cta.label}
                  href={cta.href}
                  className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium hover:underline"
                  style={{ color: activePersona.color }}
                >
                  <ArrowRight className="size-3" />
                  {cta.label}
                </Link>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
