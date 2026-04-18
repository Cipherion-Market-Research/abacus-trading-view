# CipheX Atlas

RWA (Real World Asset) token issuance and management platform built on Solana using Token-2022 (Token Extensions). Issuers create compliance-enabled tokens, onboard investors with KYC gating, distribute tokens, and enforce compliance actions (freeze, thaw, pause, force burn) — all on-chain.

Status: Phase 1A complete, running on Solana Devnet.

## Getting started

```bash
npm install
cp .env.local.example .env.local
# fill in env vars (see below)
npm run dev
```

Open http://localhost:3000.

## Environment variables

| Var | Scope | Required | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SOLANA_NETWORK` | Public | Yes | `devnet` or `mainnet-beta` |
| `NEXT_PUBLIC_RPC_ENDPOINT` | Public | Recommended | Helius RPC URL. Lock by allowed domains in the Helius dashboard. |
| `NEXT_PUBLIC_PINATA_GATEWAY` | Public | Optional | Gateway hostname (e.g. `gateway.pinata.cloud`). Read by both the server upload route and the browser. |
| `PINATA_JWT` | **Server-only** | Optional | Pinata JWT used by `/api/ipfs/upload`. Never prefix with `NEXT_PUBLIC_`. |

Without `PINATA_JWT`, the image upload falls back to a manual URL input. Without `NEXT_PUBLIC_RPC_ENDPOINT`, the app uses the rate-limited public devnet RPC and the history tab will 429.

## Pinata upload flow

Browser uploads POST to `/api/ipfs/upload`. The server reads `PINATA_JWT`, validates size (4 MB cap to fit Vercel's 4.5 MB serverless body limit) and MIME type, then calls Pinata. The JWT never reaches the browser.

Status check at `/api/ipfs/status` reports whether `PINATA_JWT` is set — the `ImageUpload` component uses this to decide between the dropzone and the URL-input fallback.

## Deploy on Vercel

1. Import the repo in Vercel. Set root directory to `cipherion-tokenize`.
2. Add the four env vars above in Project Settings → Environment Variables. Apply to Production, Preview, and Development.
3. In the Helius dashboard → RPCs → your endpoint → Access Control → Allowed Domains, add your Vercel production domain. Helius rejects `localhost` as an allowed domain — leave Allowed Domains empty for local dev, or you'll get `-32401 Unauthorized` on every paid RPC method. Previews: add `*.vercel.app` if Helius accepts wildcards in your plan, or leave rules empty.
4. Deploy.

Env var changes only take effect on **new** builds — redeploy after editing any var.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui (New York) + Radix + Lucide
- `@solana/web3.js` + `@solana/spl-token` (Token-2022)
- `@solana/wallet-adapter-react` (Phantom, Solflare, Backpack)
- `pinata-web3` SDK (server-side only)

## Further reading

Planning and research docs live in `../plans/`:

- `ATLAS_HANDOFF.md` — architecture, devnet accommodations, known gaps
- `RWA_TOKEN_PLATFORM_IMPLEMENTATION_PLAN.md` — milestones and acceptance criteria
- `RWA_TOKEN_PLATFORM_PROPOSAL.md` — chain selection, architecture rationale
- `RWA_TOKEN_PLATFORM_ADDENDUM.md` — cost forecasts, competitive landscape
- `RWA_COUNTERPARTY_FAQ.md` — stakeholder Q&A reference
