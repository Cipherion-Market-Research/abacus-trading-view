# CipheX Atlas

RWA (Real World Asset) token issuance and management platform built on Solana using Token-2022 (Token Extensions). Issuers create compliance-enabled tokens, onboard investors with KYC gating, distribute tokens, and enforce compliance actions (freeze, thaw, pause, force burn) — all on-chain.

Status: Phases 1A–1F complete (dashboard MVP + env hardening + marketing + KYC gate + design parity + mobile + demo polish). Running on Solana Devnet, deployed to Vercel. See `../plans/ATLAS_HANDOFF.md` for full current state and `../plans/ROADMAP.md` for what's next.

## Demo flow

End-to-end walkthrough on devnet, ~5 minutes:

1. **Land on `/`** → click "Get started" → 4-second mock KYC → arrive in dashboard
2. **Hit `/explorer`** → if catalog is empty, click "✨ Seed 5 demo tokens" (PageHeader actions slot) → 5 wallet sign prompts → catalog populated with realistic tokens (Treasury Note, REIT, private credit, gold, tech index)
3. **Click a yield-bearing token** (e.g., CTN-26 Treasury) → see the live yield ticker counting up at the configured APY
4. **Onboard 2+ investor wallets** via Holders tab
5. **Distributions tab** → switch to **Equal share** for an initial allocation → run → balances appear in holders' wallets
6. **Distributions again** → switch to **Pro-rata** → enter a coupon amount → preview shows per-holder shares → run → mint-to-holder executes per recipient with progress UI
7. **Compliance tab** → freeze a holder → attempt transfer from their wallet → clean rejection

## Surface map

**Public** (no wallet, no KYC): `/`, `/institutions`, `/regulation`, `/faq`, `/explorer`, `/explorer/[mint]`

**Gate**: `/signup` — 3-step mock KYC (account info → optional docs → wallet bind → 4s pending → approved)

**Gated** (KYC approved required via client guard): `/create`, `/tokens`, `/tokens/[mint]`, `/portfolio`

**API**: `/api/ipfs/upload`, `/api/ipfs/status`, `/api/mints/register`, `/api/mints/list`

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
| `KV_REST_API_URL` | **Server-only** | Optional | Backs the public `/explorer` catalog. Auto-populated by the Vercel Upstash integration. |
| `KV_REST_API_TOKEN` | **Server-only** | Optional | Pairs with the URL above. Code also accepts `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` for direct Upstash setups. |

Without `PINATA_JWT`, the image upload falls back to a manual URL input. Without the Upstash vars, token creation still works but `/explorer` shows a "not configured" banner. Without `NEXT_PUBLIC_RPC_ENDPOINT`, the app uses the rate-limited public devnet RPC and the history tab will 429.

## Atlas catalog (Explorer)

`/explorer` is a public browsable directory of every token created through Atlas, backed by Upstash Redis (via the Vercel Marketplace integration). On successful token creation the wizard POSTs to `/api/mints/register`; the server verifies the mint exists on-chain, is Token-2022, and that the claimed creator matches the on-chain mint authority before accepting the registration. `/explorer/[mint]` is the detail view.

To enable on Vercel: Marketplace → Upstash → add integration → connect to project. The env vars auto-populate.

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

- `ATLAS_HANDOFF.md` — **current state**: architecture, surface map, design system, devnet accommodations. Read this first.
- `ROADMAP.md` — remaining work categorized by priority (P0 blockers → P3 speculative)
- `RWA_TOKEN_PLATFORM_IMPLEMENTATION_PLAN.md` — milestone source of truth + build completion summary
- `RWA_TOKEN_PLATFORM_PROPOSAL.md` — original chain selection + architecture rationale (historical)
- `RWA_TOKEN_PLATFORM_ADDENDUM.md` — cost forecasts, competitive landscape (evergreen research)
- `RWA_COUNTERPARTY_FAQ.md` — stakeholder Q&A reference (content source for `/faq`)
