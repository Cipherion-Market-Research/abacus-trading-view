"use client";

import { SolanaWalletProvider } from "@/components/wallet/wallet-provider";
import { AppHeader } from "@/components/shared/app-header";
import { ToastContainer } from "@/components/ui/toast";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SolanaWalletProvider>
      <div className="flex min-h-screen flex-col bg-[#0d1117]">
        <AppHeader />
        <main className="flex-1">{children}</main>
      </div>
      <ToastContainer />
    </SolanaWalletProvider>
  );
}
