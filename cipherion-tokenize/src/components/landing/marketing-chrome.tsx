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
          <button
            onClick={handleGetStarted}
            className="rounded-full bg-[#f0f6fc] text-[#0a0e13] hover:bg-white text-xs font-medium px-[18px] py-2 transition-colors"
          >
            {ctaLabel}
          </button>
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
              <button
                onClick={handleGetStarted}
                className="w-full rounded-full bg-[#f0f6fc] text-[#0a0e13] hover:bg-white text-[14px] font-medium py-3 transition-colors"
              >
                {ctaLabel}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

export function MarketingFooter() {
  return (
    <footer className="w-full border-t border-[#21262d] py-10 md:py-12">
      <div className="mx-auto w-full max-w-[1280px] px-5 md:px-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-[12px] text-[#6e7681]">
        <Link
          href="/"
          className="inline-flex items-center gap-3 hover:text-[#f0f6fc] transition-colors"
        >
          <AtlasLogo size={20} />
          <span className="text-[#f0f6fc] font-semibold text-[14px] tracking-tight inline-flex items-baseline">
            Atlas
            <span className="font-mono text-[10px] font-medium tracking-[0.12em] text-[#8b949e] uppercase pl-2 ml-2 border-l border-[#30363d]">
              by CipheX
            </span>
          </span>
        </Link>
        <div>
          © 2026 Cipherion Systems · Token-2022 platform · all amounts
          verifiable on-chain
        </div>
      </div>
    </footer>
  );
}
