"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
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

  const handleGetStarted = () => {
    if (status === "approved") {
      router.push("/tokens");
    } else {
      router.push("/signup");
    }
  };

  const handleSignIn = () => {
    if (status === "approved") {
      router.push("/tokens");
    } else if (connected) {
      router.push("/signup");
    } else {
      setVisible(true);
    }
  };

  const ctaLabel =
    status === "approved" ? "Go to dashboard" : "Book a walkthrough";

  return (
    <div className="w-full">
      <nav className="mx-auto flex w-full max-w-[1280px] items-center gap-8 px-8 py-7">
        <Link href="/" aria-label="Atlas home">
          <AtlasWordmark size={26} />
        </Link>
        <div className="hidden md:flex gap-7 text-[13px] font-medium text-[#8b949e]">
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
        <div className="ml-auto flex items-center gap-3">
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
      </nav>
    </div>
  );
}

export function MarketingFooter() {
  return (
    <footer className="w-full border-t border-[#21262d] py-12">
      <div className="mx-auto w-full max-w-[1280px] px-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-[12px] text-[#6e7681]">
        <Link
          href="/"
          className="inline-flex items-center gap-3 hover:text-[#f0f6fc] transition-colors"
        >
          <AtlasLogo size={20} />
          <span className="text-[#f0f6fc] font-semibold text-[14px] tracking-tight inline-flex items-baseline">
            <span className="font-mono text-[10px] font-medium tracking-[0.12em] text-[#8b949e] uppercase pr-2 mr-2 border-r border-[#30363d]">
              CPX
            </span>
            Atlas
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

