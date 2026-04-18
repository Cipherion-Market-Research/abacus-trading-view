"use client";

import { CreateWizard } from "@/components/token/create-wizard";
import { RequireKyc } from "@/components/auth/require-kyc";

export default function CreateTokenPage() {
  return (
    <RequireKyc>
      <div className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="text-xl font-semibold text-[#f0f6fc] mb-1">
          Create Token
        </h1>
        <p className="text-sm text-[#8b949e] mb-6">
          Configure and deploy a new RWA token with compliance extensions on
          Solana.
        </p>
        <CreateWizard />
      </div>
    </RequireKyc>
  );
}
