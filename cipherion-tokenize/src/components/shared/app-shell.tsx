"use client";

import { usePathname } from "next/navigation";
import { SolanaWalletProvider } from "@/components/wallet/wallet-provider";
import { AppHeader } from "@/components/shared/app-header";
import { ToastContainer } from "@/components/ui/toast";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const MARKETING_ROUTES = new Set([
    "/",
    "/faq",
    "/institutions",
    "/regulation",
    "/signup",
  ]);
  const hideAppChrome = MARKETING_ROUTES.has(pathname);

  return (
    <SolanaWalletProvider>
      <div className="flex min-h-screen flex-col bg-[#0d1117]">
        {!hideAppChrome && <AppHeader />}
        <main className="flex-1">{children}</main>
      </div>
      <ToastContainer />
    </SolanaWalletProvider>
  );
}
