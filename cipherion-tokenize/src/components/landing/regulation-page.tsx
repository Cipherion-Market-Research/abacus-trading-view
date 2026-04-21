"use client";

import {
  MarketingNav,
  MarketingFooter,
} from "@/components/landing/marketing-chrome";

interface FrameworkRow {
  jurisdiction: string;
  regulator: string;
  scope: string;
  required: string[];
}

const FRAMEWORKS: FrameworkRow[] = [
  {
    jurisdiction: "United States",
    regulator: "SEC",
    scope: "Reg D · Reg S · Reg A+",
    required: [
      "Transfer restrictions",
      "Holder registry",
      "Forced transfer on court order",
    ],
  },
  {
    jurisdiction: "European Union",
    regulator: "ESMA · EBA",
    scope: "MiCA · MiFID II",
    required: [
      "Governance controls",
      "Smart-contract enforceability",
      "Asset-referenced token rules",
    ],
  },
  {
    jurisdiction: "Singapore",
    regulator: "MAS",
    scope: "CMS · RMO · Project Guardian",
    required: [
      "Holder registry",
      "Transfer eligibility control",
      "On-chain compliance",
    ],
  },
  {
    jurisdiction: "Dubai",
    regulator: "VARA",
    scope: "VASP licensing",
    required: [
      "Freeze on regulator order",
      "Forced seize capabilities",
      "Sanctions screening",
    ],
  },
  {
    jurisdiction: "Switzerland",
    regulator: "FINMA",
    scope: "DLT Act",
    required: [
      "Registered tokenized securities",
      "Compliance infrastructure",
      "Custody segregation",
    ],
  },
];

interface ExtensionMap {
  extension: string;
  purpose: string;
  satisfies: string;
}

const EXTENSIONS: ExtensionMap[] = [
  {
    extension: "DefaultAccountState=Frozen",
    purpose: "KYC gating",
    satisfies: "Reg D/S/A+ · MiCA · MAS — investor eligibility",
  },
  {
    extension: "Freeze / Thaw authority",
    purpose: "Account-level holds",
    satisfies: "Court orders · regulatory holds · KYC expiry",
  },
  {
    extension: "PermanentDelegate",
    purpose: "Forced transfer / burn",
    satisfies: "Sanctions enforcement · estate settlement · VARA directives",
  },
  {
    extension: "Pausable",
    purpose: "Emergency halt",
    satisfies: "Regulatory emergency · NAV recalculation",
  },
  {
    extension: "TransferHook",
    purpose: "Programmable compliance",
    satisfies:
      "Jurisdiction checks · investor caps · compliant DEX whitelisting",
  },
  {
    extension: "MetadataPointer",
    purpose: "On-chain registry",
    satisfies: "ISIN · custodian · regulatory framework · jurisdiction",
  },
];

const EVM_EXTENSIONS: ExtensionMap[] = [
  {
    extension: "ONCHAINID",
    purpose: "On-chain identity claims",
    satisfies: "Reg D/S/A+ · MiCA · MAS — verifiable KYC credentials per wallet",
  },
  {
    extension: "Identity Registry",
    purpose: "Investor whitelist",
    satisfies: "Holder eligibility · jurisdiction mapping · accreditation verification",
  },
  {
    extension: "Compliance Contract",
    purpose: "Transfer rules engine",
    satisfies: "Country restrictions · investor caps · max balance enforcement",
  },
  {
    extension: "Freeze / Pause",
    purpose: "Account + token-level holds",
    satisfies: "Court orders · regulatory holds · sanctions enforcement · VARA directives",
  },
  {
    extension: "Recovery (Agent)",
    purpose: "Forced transfer / seizure",
    satisfies: "Estate settlement · sanctions recovery · court-ordered transfer",
  },
  {
    extension: "Claim Topics",
    purpose: "Structured identity data",
    satisfies: "Accredited investor status · jurisdiction · KYC expiry · regulatory framework",
  },
];

export function RegulationPage() {
  return (
    <div className="bg-[#0a0e13] text-[#f0f6fc] -mt-px min-h-screen">
      <MarketingNav />

      {/* ─── Hero ─── */}
      <section className="mx-auto max-w-[1280px] px-5 md:px-8 pt-10 md:pt-16 pb-10 md:pb-14 border-b border-[#21262d]">
        <div className="mb-4 md:mb-5 font-mono text-[10px] md:text-[11px] font-medium uppercase tracking-[0.14em] text-[#3fb950]">
          / regulation
        </div>
        <h1 className="m-0 mb-5 md:mb-6 max-w-[960px] text-[36px] md:text-[52px] xl:text-[68px] font-semibold leading-[1.0] md:leading-[0.98] tracking-[-0.035em]">
          Two compliance standards. Five jurisdictions. Every requirement{" "}
          <span className="text-[#3fb950]">mapped</span>.
        </h1>
        <p className="m-0 max-w-[620px] text-[15px] md:text-[17px] xl:text-[18px] leading-[1.55] text-[#8b949e]">
          Every compliance primitive lines up with a mechanism regulators
          require — Token-2022 on Solana, ERC-3643 on EVM. Below: which
          frameworks matter, what they demand, and which Atlas control
          satisfies each.
        </p>
      </section>

      {/* ─── Frameworks table ─── */}
      <section className="mx-auto max-w-[1280px] px-5 md:px-8 py-14 md:py-20">
        <div className="mb-4 md:mb-5 font-mono text-[10px] md:text-[11px] font-medium uppercase tracking-[0.14em] text-[#3fb950]">
          / frameworks
        </div>
        <h2 className="m-0 mb-8 md:mb-10 max-w-[820px] text-[26px] md:text-[30px] xl:text-[36px] font-semibold leading-[1.1] tracking-[-0.03em]">
          Five jurisdictions. Two compliance standards.
        </h2>

        {/* Desktop / tablet: 4-column table */}
        <div className="hidden md:block overflow-hidden rounded-xl border border-[#21262d]">
          <div className="grid grid-cols-[1.2fr_1fr_1.2fr_2fr] bg-[#0d1117] border-b border-[#21262d] text-[10px] uppercase tracking-[0.12em] font-mono text-[#6e7681]">
            <ThCell>Jurisdiction</ThCell>
            <ThCell>Regulator</ThCell>
            <ThCell>Scope</ThCell>
            <ThCell>Required mechanisms</ThCell>
          </div>
          {FRAMEWORKS.map((f, i) => (
            <div
              key={f.jurisdiction}
              className={`grid grid-cols-[1.2fr_1fr_1.2fr_2fr] bg-[#0a0e13] text-[13px] ${i < FRAMEWORKS.length - 1 ? "border-b border-[#21262d]" : ""}`}
            >
              <div className="px-5 py-4 text-[#f0f6fc] font-medium">
                {f.jurisdiction}
              </div>
              <div className="px-5 py-4 font-mono text-[#c9d1d9]">
                {f.regulator}
              </div>
              <div className="px-5 py-4 text-[#c9d1d9]">{f.scope}</div>
              <div className="px-5 py-4 text-[#8b949e] text-[12px]">
                {f.required.join(" · ")}
              </div>
            </div>
          ))}
        </div>

        {/* Mobile: cards */}
        <div className="md:hidden space-y-3">
          {FRAMEWORKS.map((f) => (
            <div
              key={f.jurisdiction}
              className="rounded-lg border border-[#21262d] bg-[#0d1117] p-4"
            >
              <div className="flex items-baseline justify-between mb-2 gap-3">
                <h3 className="m-0 text-[15px] font-semibold text-[#f0f6fc]">
                  {f.jurisdiction}
                </h3>
                <span className="font-mono text-[11px] text-[#c9d1d9]">
                  {f.regulator}
                </span>
              </div>
              <div className="mb-3 text-[12px] text-[#c9d1d9]">{f.scope}</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#6e7681] mb-1.5">
                Required mechanisms
              </div>
              <ul className="m-0 pl-0 list-none space-y-1">
                {f.required.map((r) => (
                  <li
                    key={r}
                    className="text-[12px] text-[#8b949e] before:content-['·'] before:mr-2 before:text-[#3fb950]"
                  >
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Extension mapping ─── */}
      <section className="mx-auto max-w-[1280px] px-5 md:px-8 py-14 md:py-20 border-t border-[#21262d]">
        <div className="mb-4 md:mb-5 font-mono text-[10px] md:text-[11px] font-medium uppercase tracking-[0.14em] text-[#3fb950]">
          / Solana · Token-2022
        </div>
        <h2 className="m-0 mb-8 md:mb-10 max-w-[820px] text-[26px] md:text-[30px] xl:text-[36px] font-semibold leading-[1.1] tracking-[-0.03em]">
          Which protocol primitive satisfies which rule.
        </h2>

        {/* Desktop / tablet: 3-column table */}
        <div className="hidden md:block overflow-hidden rounded-xl border border-[#21262d]">
          <div className="grid grid-cols-[1.3fr_1fr_2fr] bg-[#0d1117] border-b border-[#21262d] text-[10px] uppercase tracking-[0.12em] font-mono text-[#6e7681]">
            <ThCell>Extension</ThCell>
            <ThCell>Purpose</ThCell>
            <ThCell>Satisfies</ThCell>
          </div>
          {EXTENSIONS.map((e, i) => (
            <div
              key={e.extension}
              className={`grid grid-cols-[1.3fr_1fr_2fr] bg-[#0a0e13] text-[13px] ${i < EXTENSIONS.length - 1 ? "border-b border-[#21262d]" : ""}`}
            >
              <div className="px-5 py-4 font-mono text-[#c9d1d9]">
                {e.extension}
              </div>
              <div className="px-5 py-4 text-[#f0f6fc]">{e.purpose}</div>
              <div className="px-5 py-4 text-[#8b949e] text-[12px]">
                {e.satisfies}
              </div>
            </div>
          ))}
        </div>

        {/* Mobile: cards */}
        <div className="md:hidden space-y-3">
          {EXTENSIONS.map((e) => (
            <div
              key={e.extension}
              className="rounded-lg border border-[#21262d] bg-[#0d1117] p-4"
            >
              <div className="font-mono text-[12px] text-[#c9d1d9] mb-2 break-all">
                {e.extension}
              </div>
              <div className="text-[14px] font-medium text-[#f0f6fc] mb-2">
                {e.purpose}
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#6e7681] mb-1">
                Satisfies
              </div>
              <div className="text-[12px] text-[#8b949e]">{e.satisfies}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── EVM mapping ─── */}
      <section className="mx-auto max-w-[1280px] px-5 md:px-8 py-14 md:py-20 border-t border-[#21262d]">
        <div className="mb-4 md:mb-5 font-mono text-[10px] md:text-[11px] font-medium uppercase tracking-[0.14em] text-[#58a6ff]">
          / EVM · ERC-3643 (T-REX)
        </div>
        <h2 className="m-0 mb-8 md:mb-10 max-w-[820px] text-[26px] md:text-[30px] xl:text-[36px] font-semibold leading-[1.1] tracking-[-0.03em]">
          The same rules, enforced on Base, Ethereum & Polygon.
        </h2>

        <div className="hidden md:block overflow-hidden rounded-xl border border-[#21262d]">
          <div className="grid grid-cols-[1.3fr_1fr_2fr] bg-[#0d1117] border-b border-[#21262d] text-[10px] uppercase tracking-[0.12em] font-mono text-[#6e7681]">
            <ThCell>ERC-3643 Mechanism</ThCell>
            <ThCell>Purpose</ThCell>
            <ThCell>Satisfies</ThCell>
          </div>
          {EVM_EXTENSIONS.map((e, i) => (
            <div
              key={e.extension}
              className={`grid grid-cols-[1.3fr_1fr_2fr] bg-[#0a0e13] text-[13px] ${i < EVM_EXTENSIONS.length - 1 ? "border-b border-[#21262d]" : ""}`}
            >
              <div className="px-5 py-4 font-mono text-[#c9d1d9]">
                {e.extension}
              </div>
              <div className="px-5 py-4 text-[#f0f6fc]">{e.purpose}</div>
              <div className="px-5 py-4 text-[#8b949e] text-[12px]">
                {e.satisfies}
              </div>
            </div>
          ))}
        </div>

        <div className="md:hidden space-y-3">
          {EVM_EXTENSIONS.map((e) => (
            <div
              key={e.extension}
              className="rounded-lg border border-[#21262d] bg-[#0d1117] p-4"
            >
              <div className="font-mono text-[12px] text-[#c9d1d9] mb-2 break-all">
                {e.extension}
              </div>
              <div className="text-[14px] font-medium text-[#f0f6fc] mb-2">
                {e.purpose}
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#6e7681] mb-1">
                Satisfies
              </div>
              <div className="text-[12px] text-[#8b949e]">{e.satisfies}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Audit posture ─── */}
      <section className="mx-auto max-w-[1280px] px-5 md:px-8 py-14 md:py-20 border-t border-[#21262d] grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-10 md:gap-[72px]">
        <div>
          <div className="mb-4 md:mb-5 font-mono text-[10px] md:text-[11px] font-medium uppercase tracking-[0.14em] text-[#3fb950]">
            / audit posture
          </div>
          <h2 className="m-0 mb-5 md:mb-6 text-[26px] md:text-[30px] xl:text-[36px] font-semibold leading-[1.05] tracking-[-0.03em]">
            Audited once. Shared by every issuer.
          </h2>
          <p className="text-[#8b949e] text-[14px] md:text-[15px] leading-[1.6]">
            Atlas inherits Token-2022&apos;s audit history. The program has
            been reviewed by Neodyme and multiple third parties, secured
            billions on-chain since 2023, and published a public security
            analysis of extension interactions.
          </p>
        </div>

        <div className="space-y-4">
          <Callout
            title="Open-source, verifiable on-chain"
            body="Token-2022 program ID is public and identical on Devnet, Testnet, and Mainnet. Anyone can reproduce the bytecode from source."
          />
          <Callout
            title="Neodyme security analysis"
            body="Full writeup of extension-interaction pitfalls (e.g. PermanentDelegate in DeFi vault accounts, TransferFeeConfig escrow math)."
          />
          <Callout
            title="Deployed in production since 2023"
            body="Running at the BlackRock, Franklin Templeton, and Ondo asset-manager scale. The $2B+ tokenized RWA market on Solana uses this program."
          />
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

function ThCell({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-3.5">{children}</div>;
}

function Callout({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-[#21262d] bg-[#0d1117] p-5">
      <h3 className="m-0 mb-2 text-[15px] font-semibold text-[#f0f6fc]">
        {title}
      </h3>
      <p className="m-0 text-[13px] text-[#8b949e] leading-[1.6]">{body}</p>
    </div>
  );
}
