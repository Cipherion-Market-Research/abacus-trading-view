"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { AtlasLogo, AtlasWordmark } from "@/components/shared/atlas-logo";
import { useKycStatus } from "@/hooks/use-kyc-status";

interface NavLink {
  href: string;
  label: string;
}

const LINKS: NavLink[] = [
  { href: "/", label: "Platform" },
  { href: "/institutions", label: "For institutions" },
  { href: "/regulation", label: "Regulation" },
  { href: "/faq", label: "FAQ" },
];

export function MarketingNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { status } = useKycStatus();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleGetStarted = () => {
    if (status === "approved") {
      router.push("/tokens");
    } else {
      router.push("/signup");
    }
    setMobileOpen(false);
  };

  const handleSignIn = () => {
    if (status === "approved") {
      router.push("/tokens");
    } else if (connected) {
      router.push("/signup");
    } else {
      setVisible(true);
    }
    setMobileOpen(false);
  };

  const ctaLabel =
    status === "approved" ? "Go to dashboard" : "Book a walkthrough";

  return (
    <div className="w-full">
      <nav className="mx-auto flex w-full max-w-[1280px] items-center gap-4 md:gap-8 px-5 md:px-8 py-5 md:py-7">
        <Link href="/" aria-label="Atlas home" className="inline-flex">
          <AtlasWordmark size={36} compact />
        </Link>
        <div className="hidden md:flex gap-7 text-[13px] font-medium text-[#8b949e] translate-y-[2px]">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  active
                    ? "text-[#f0f6fc] cursor-default"
                    : "hover:text-[#f0f6fc] transition-colors"
                }
              >
                {link.label}
              </Link>
            );
          })}
        </div>
        <div className="ml-auto hidden md:flex items-center gap-3">
          <button
            onClick={handleSignIn}
            className="text-[#c9d1d9] hover:text-[#f0f6fc] text-xs font-medium px-4 py-2 transition-colors"
          >
            Sign in
          </button>
          {/* HIDDEN: restore for post-investor-round launch
          <button
            onClick={handleGetStarted}
            className="rounded-full bg-[#f0f6fc] text-[#0a0e13] hover:bg-white text-xs font-medium px-[18px] py-2 transition-colors"
          >
            {ctaLabel}
          </button>
          */}
        </div>

        {/* Mobile hamburger — visible below md */}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="ml-auto md:hidden inline-flex items-center justify-center size-10 rounded-md border border-[#30363d] bg-[#161b22] text-[#c9d1d9] hover:text-[#f0f6fc] hover:border-[#484f58] transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
        </button>
      </nav>

      {/* Mobile nav sheet */}
      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-[#0a0e13] border-l border-[#21262d] shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right md:hidden"
          >
            <div className="flex items-center justify-between px-5 py-5 border-b border-[#21262d]">
              <Dialog.Title asChild>
                <Link
                  href="/"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex"
                >
                  <AtlasWordmark size={28} compact />
                </Link>
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center size-10 rounded-md text-[#8b949e] hover:text-[#f0f6fc] transition-colors"
                  aria-label="Close menu"
                >
                  <X className="size-5" />
                </button>
              </Dialog.Close>
            </div>

            <div className="flex flex-col py-4 px-3">
              {LINKS.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`px-3 py-4 rounded-md text-[16px] font-medium transition-colors ${
                      active
                        ? "text-[#f0f6fc] bg-[#161b22]"
                        : "text-[#c9d1d9] hover:text-[#f0f6fc] hover:bg-[#161b22]"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>

            <div className="mt-auto flex flex-col gap-2.5 px-5 py-5 border-t border-[#21262d]">
              <button
                onClick={handleSignIn}
                className="w-full rounded-md border border-[#30363d] bg-[#161b22] text-[#c9d1d9] hover:text-[#f0f6fc] hover:border-[#484f58] text-[14px] font-medium py-3 transition-colors"
              >
                Sign in
              </button>
              {/* HIDDEN: restore for post-investor-round launch
              <button
                onClick={handleGetStarted}
                className="w-full rounded-full bg-[#f0f6fc] text-[#0a0e13] hover:bg-white text-[14px] font-medium py-3 transition-colors"
              >
                {ctaLabel}
              </button>
              */}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

const FOOTER_NAV = [
  {
    heading: "Disclosures",
    links: [
      { label: "Regulatory Disclosure", href: "https://ciphex.io/regulatory-disclosure" },
      { label: "CPX Tokens & Trading", href: "https://ciphex.io/cpx-tokens-and-trading" },
      { label: "Market Risk Factors", href: "https://ciphex.io/statement-of-risk" },
    ],
  },
  {
    heading: "Ecosystem",
    links: [
      { label: "CipheX Alpha", href: "https://ams.ciphex.io/" },
      { label: "Publications", href: "https://ciphex.io/publications" },
      { label: "Internal Updates", href: "https://ciphex.io/internal-updates" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "CertiK Skynet Audit", href: "https://skynet.certik.com/projects/ciphex", external: true },
      { label: "GitHub Repository", href: "https://github.com/Cipherion-Market-Research", external: true },
    ],
  },
  {
    heading: "Follow Us",
    links: [
      { label: "X (Twitter)", href: "https://x.com/ciphexio", external: true },
      { label: "Telegram", href: "https://t.me/ciphexgroup", external: true },
    ],
  },
] as const;

export function MarketingFooter() {
  return (
    <footer className="w-full border-t border-[#21262d]">
      {/* ─── Top: logo + nav columns ─── */}
      <div className="mx-auto w-full max-w-[1280px] px-5 md:px-8 py-10 md:py-14">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-10 lg:gap-0">
          <Link
            href="/"
            className="inline-flex items-center gap-3 hover:opacity-80 transition-opacity shrink-0"
          >
            <AtlasLogo className="size-6 md:size-9" />
            <span className="text-[#f0f6fc] font-semibold text-[16px] md:text-[22px] tracking-tight inline-flex items-baseline">
              Atlas
              <span className="font-mono text-[10px] md:text-[12px] font-medium tracking-[0.12em] text-[#8b949e] uppercase pl-2 ml-2 border-l border-[#30363d]">
                by CipheX
              </span>
            </span>
          </Link>

          <nav className="grid grid-cols-2 gap-8 md:flex md:flex-row md:gap-14">
            {FOOTER_NAV.map((col) => (
              <div key={col.heading} className="flex flex-col gap-3">
                <h3 className="text-[#f0f6fc] font-semibold text-[13px]">
                  {col.heading}
                </h3>
                <ul className="flex flex-col gap-2">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        {...("external" in link && link.external
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                        className="text-[#8b949e] hover:text-[#3fb950] text-[12px] transition-colors"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </div>

      {/* ─── Important notice ─── */}
      <div className="border-t border-[#21262d]">
        <div className="mx-auto w-full max-w-[1280px] px-5 md:px-8 py-8 md:py-10">
          <p className="text-[#f0f6fc] font-semibold text-[11px] md:text-[12px] mb-3">
            Important Notice to Reader
          </p>
          <p className="text-[#6e7681] text-[10px] md:text-[11px] leading-[1.7] text-justify">
            The following information is strictly for presentation and
            illustrative purposes only. It does not constitute an offer to sell,
            a solicitation of an offer to buy, or a recommendation to invest in
            any securities, digital assets, investment products, or financial
            instruments associated with the Alpha Centurion Network (Alpha CPX)
            or CipheX Capital Ecosystem (collectively referred to as CipheX). No
            information contained herein should be construed as investment,
            legal, accounting, or tax advice. You should not rely on any
            information on this website as a substitute for professional advice
            from qualified advisors. Any descriptions of potential market
            strategies, financial models, or projected outcomes are provided
            solely for illustrative purposes. Participation in digital asset
            markets involves substantial risk, including the potential loss of
            your entire investment. Digital assets may be subject to extreme
            volatility, limited liquidity, and rapidly evolving legal and
            regulatory frameworks. No assurance can be given that any investment
            or trading activity will achieve favorable or expected outcomes. Any
            statements or representations not originating directly from CipheX,
            Cipherion Capital SA, or its authorized affiliates are unauthorized
            and expressly disclaimed. CipheX reserves the right to update or
            modify any information published on its website at any time without
            advanced notice. These updates may include, but are not limited to,
            updates to ecosystem and service policies, tokenomics, and pricing
            guidelines related to CipheX or its services. Please refer to the
            Internal Updates section of the website for ecosystem changes and
            amendments to any of its policies. Users are encouraged to review
            this section regularly to stay informed of the most current
            information. Access to CipheX services may be restricted or
            prohibited in some jurisdictions.{" "}
            <strong className="text-[#8b949e]">
              Past performance is not indicative of future results.
            </strong>
          </p>
        </div>
      </div>

      {/* ─── Bottom bar ─── */}
      <div className="border-t border-[#21262d]">
        <div className="mx-auto w-full max-w-[1280px] px-5 md:px-8 py-5 md:py-6">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            <p className="text-[#6e7681] text-[11px]">
              &copy; 2026{" "}
              <a
                href="https://www.cipherion.co/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#6e7681] hover:text-[#f0f6fc] transition-colors"
              >
                Cipherion Capital SA
              </a>
              {" · "}CipheX Capital Ecosystem
            </p>

            <div className="flex items-center gap-6">
              <a
                href="https://ciphex.io/terms-of-use"
                className="text-[#6e7681] hover:text-[#3fb950] text-[11px] transition-colors"
              >
                Terms of Use
              </a>
              <a
                href="https://ciphex.io/privacy-policy"
                className="text-[#6e7681] hover:text-[#3fb950] text-[11px] transition-colors"
              >
                Privacy Policy
              </a>
              <a
                href="https://ciphex.io/contact"
                className="text-[#6e7681] hover:text-[#3fb950] text-[11px] transition-colors"
              >
                Contact
              </a>
            </div>

            <a
              href="https://ciphex.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#6e7681] hover:text-[#3fb950] text-[11px] font-semibold transition-colors"
            >
              Powered by Cipherion (CPX)
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
