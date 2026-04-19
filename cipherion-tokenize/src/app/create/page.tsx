"use client";

import { CreateWizard } from "@/components/token/create-wizard";
import { RequireKyc } from "@/components/auth/require-kyc";
import { PageHeader } from "@/components/shared/page-header";

export default function CreateTokenPage() {
  return (
    <RequireKyc>
      <div className="mx-auto max-w-3xl px-5 md:px-6 py-6 md:py-8">
        <PageHeader
          eyebrow="token creation"
          title="Create a regulated token"
          subtitle="Configure extensions, supply, and metadata on Solana."
        />
        <CreateWizard />
      </div>
    </RequireKyc>
  );
}
