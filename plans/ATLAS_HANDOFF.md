# CipheX Atlas — Agent Handoff Document

**Last updated:** 2026-04-18 (end of Phase 1F)
**Purpose:** Complete context for a new coding agent to continue development. Copy-paste this into a new conversation.

---

## Project Summary

CipheX Atlas is an RWA (Real World Asset) token issuance and management platform built on Solana using Token-2022 (Token Extensions). Issuers create compliance-enabled tokens, onboard investors with KYC gating, distribute tokens, and enforce compliance actions (freeze, thaw, pause, force burn) — all on-chain.

The product is a dashboard for authenticated users, sitting behind a public marketing shell and a mock institutional KYC gate. Visually unified between marketing and dashboard: one type system, one color palette, one logo.

**Live on:** Solana Devnet (tokens are real on-chain, using test SOL)
**Deployed to:** Vercel (preview + production)
**First token created:** "Test Fund A" — [VzZngWaHydAtKnXC4bT8b4WpvVJY1oG4VzB3eY97eiu](https://explorer.solana.com/address/VzZngWaHydAtKnXC4bT8b4WpvVJY1oG4VzB3eY97eiu?cluster=devnet)

---

## Surface Map

### Public (no wallet, no KYC)
| Route | Purpose |
|---|---|
| `/` | Marketing landing — hero, 4 pillars, pull quote, issuer market grid |
| `/institutions` | Institutional pitch — differentiators, cost-at-scale table, CTA |
| `/regulation` | Regulatory mapping — 5-jurisdiction framework table, extension → requirement map, audit posture |
| `/faq` | Split-persona FAQ — Issuers / Investors / Compliance / Technical, accordion + CTA sidebar |
| `/explorer` | Public Atlas catalog (all registered tokens, searchable) |
| `/explorer/[mint]` | Public token detail |

### Gate
| Route | Purpose |
|---|---|
| `/signup` | 3-step mock KYC — account info → docs (optional) → wallet bind → 4s pending → approved → /tokens |

### Gated (KYC approved required)
| Route | Purpose |
|---|---|
| `/create` | Token creation wizard (5 steps) |
| `/tokens` | Issuer's token list |
| `/tokens/[mint]` | Token dashboard — Holders, Mint, **Distributions**, Details, Compliance, History |
| `/portfolio` | Investor holdings + transfer |

### API
| Route | Purpose |
|---|---|
| `POST /api/ipfs/upload` | Pinata-backed image upload (server-side, JWT never sent to browser) |
| `GET /api/ipfs/status` | Client-side probe for whether `PINATA_JWT` is configured |
| `POST /api/mints/register` | Register a newly created mint in the Atlas catalog (verifies on-chain authority match before accepting) |
| `GET /api/mints/list` | Read all registered mints |

---

## Repository Structure

```
abacus-trading-view/                           # Parent repo
├── ciphex-predictions/                        # Sibling product (do NOT modify)
├── cipherion-tokenize/                        # CipheX Atlas app (this project)
│   ├── src/
│   │   ├── app/
│   │   │   ├── icon.svg                       # Polaris favicon (browser tab)
│   │   │   ├── apple-icon.svg                 # iOS home-screen icon (180×180)
│   │   │   ├── layout.tsx                     # Geist + Geist_Mono fonts, AppShell
│   │   │   ├── page.tsx                       # Landing
│   │   │   ├── globals.css                    # Tailwind base, iOS input-zoom rule
│   │   │   ├── institutions/page.tsx
│   │   │   ├── regulation/page.tsx
│   │   │   ├── faq/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   ├── create/page.tsx
│   │   │   ├── tokens/page.tsx
│   │   │   ├── tokens/[mint]/page.tsx
│   │   │   ├── portfolio/page.tsx
│   │   │   ├── explorer/page.tsx
│   │   │   ├── explorer/[mint]/page.tsx
│   │   │   └── api/
│   │   │       ├── ipfs/upload/route.ts
│   │   │       ├── ipfs/status/route.ts
│   │   │       ├── mints/register/route.ts
│   │   │       └── mints/list/route.ts
│   │   ├── components/
│   │   │   ├── auth/                          # RequireKyc guard, KycPill
│   │   │   ├── landing/                       # LandingPage, InstitutionsPage,
│   │   │   │                                  # RegulationPage, MarketingNav/Footer
│   │   │   ├── faq/                           # FaqPage with persona split
│   │   │   ├── signup/                        # SignupFlow (3-step wizard)
│   │   │   ├── wallet/                        # Wallet provider + connect button
│   │   │   ├── token/                         # Create wizard, mint form, stats,
│   │   │   │                                  # card, YieldTicker
│   │   │   ├── distribution/                  # DistributionForm, DistributionHistory
│   │   │   ├── explorer/                      # SeedDemoButton (admin)
│   │   │   ├── holders/                       # Cap table, onboard form
│   │   │   ├── transfer/                      # Transfer form + fee preview
│   │   │   ├── compliance/                    # Freeze/thaw/pause/burn panel
│   │   │   ├── history/                       # Transaction list + CSV export
│   │   │   ├── shared/                        # AtlasLogo, AtlasWordmark, PageHeader,
│   │   │   │                                  # TokenAvatar, AppShell, AppHeader,
│   │   │   │                                  # AddressDisplay, ExplorerLink,
│   │   │   │                                  # NetworkBadge, etc.
│   │   │   └── ui/                            # shadcn/ui primitives
│   │   ├── hooks/                             # use-kyc-status, use-send-transaction,
│   │   │                                      # use-token-*, use-transfer-fee,
│   │   │                                      # use-seed-demo, etc.
│   │   ├── lib/
│   │   │   ├── solana/                        # All Solana RPC + Token-2022 operations
│   │   │   │   ├── token-service.ts
│   │   │   │   ├── account-service.ts
│   │   │   │   ├── compliance-service.ts
│   │   │   │   ├── distribution-service.ts    # Pro-rata + equal-share allocation,
│   │   │   │   │                              # mint-to-holder execution
│   │   │   │   ├── metadata-service.ts
│   │   │   │   ├── history-service.ts
│   │   │   │   ├── connection.ts
│   │   │   │   ├── constants.ts
│   │   │   │   └── types.ts
│   │   │   ├── pinata.ts                      # Client wrapper → /api/ipfs/upload
│   │   │   ├── registry.ts                    # Upstash Redis client (server-only)
│   │   │   ├── kyc.ts                         # localStorage KYC state (client-only)
│   │   │   ├── distributions.ts               # localStorage distribution history per mint
│   │   │   ├── demo-seeds.ts                  # 5 sample tokens for /explorer seeder
│   │   │   └── utils/                         # Format, validation, CSV, transfer-fee
│   │   ├── config/
│   │   │   └── asset-templates.ts             # 6 RWA asset type templates
│   │   └── types/
│   │       └── token.ts                       # Re-exports from lib/solana/types
│   ├── .env.local.example                     # Env var template
│   ├── next.config.ts                         # Bare config (no output: standalone — Vercel)
│   ├── components.json                        # shadcn config
│   └── package.json                           # Package: ciphex-atlas
├── plans/
│   ├── ATLAS_HANDOFF.md                       # THIS FILE
│   ├── ROADMAP.md                             # Remaining work, prioritized
│   ├── RWA_TOKEN_PLATFORM_PROPOSAL.md         # Original research + chain comparison
│   ├── RWA_TOKEN_PLATFORM_ADDENDUM.md         # Cost forecasts, competitor landscape
│   ├── RWA_TOKEN_PLATFORM_IMPLEMENTATION_PLAN.md  # Milestone source of truth
│   └── RWA_COUNTERPARTY_FAQ.md                # 40+ Q&A for stakeholders/sales
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.4 (App Router, Turbopack), React 19, TypeScript strict |
| Styling | Tailwind CSS 4, shadcn/ui (New York), Radix UI, Lucide icons |
| Fonts | Geist + Geist Mono via `next/font/google` — no serif display face |
| Blockchain | Solana Token-2022 via `@solana/web3.js` + `@solana/spl-token` |
| Wallet | `@solana/wallet-adapter-react` (Phantom, Solflare, Backpack) |
| IPFS | `pinata-web3` SDK (server-side only, via API route proxy) |
| Registry | Upstash Redis (Vercel Marketplace integration) |
| Theme | Dark-only. Canvas `#0a0e13`, borders `#30363d`, accents green/blue/yellow/red |

---

## Design System Summary

**Logo:** Polaris Crosshair — concentric circles + 45°-rotated four-pointed star + white center dot. Rendered by `AtlasLogo` / `AtlasWordmark` components. Favicon lives at `src/app/icon.svg` (rounded-square backdrop for tabs) and `apple-icon.svg` (180×180 for iOS installs).

**Wordmark lock:** `Atlas | BY CIPHEX` — "Atlas" in Geist Semibold, "BY CIPHEX" in Geist Mono 9–10px uppercase with `border-l` separator. `compact` prop on `AtlasWordmark` bumps sizing for dense nav rows.

**Typography scale (all Geist Sans + Geist Mono — no serif):**

| Element | Mobile | Tablet | Desktop |
|---|---|---|---|
| Marketing hero h1 | 40px | 56px | 80px |
| Institutions / Regulation hero | 36px | 52px | 68px |
| FAQ / Signup h1 | 32px | 44px | 60/44px |
| Marketing section h2 | 26–28px | 30–32px | 36–40px |
| Dashboard page title (`PageHeader`) | 24px | 28px | 32px |
| Mono eyebrow | 10px | 11px | 11px |
| Body lead | 14–15px | 16–17px | 17–19px |
| Body | 13–14px | 14px | 14–15px |
| Pull quote | 22px | 26px | 32px (sans, not serif) |

All display type uses `font-semibold` with aggressive tight tracking (`-0.03em` to `-0.04em`). Emphasis is carried by green color accent (`#3fb950`) on pivotal words — no italics.

**Shared primitives:**
- `PageHeader` — dashboard pages. Eyebrow (`/ section`) + title + optional subtitle + right-action slot.
- `MarketingNav` / `MarketingFooter` — shared across `/`, `/institutions`, `/regulation`, `/faq`, `/signup`. Includes hamburger + sheet for mobile.
- `AppHeader` — gated-dashboard chrome. Nav collapses into sheet below `md`. KYC pill + network badge live in the sheet on mobile under "System status".
- `RequireKyc` — client guard wrapping gated routes. Redirects to `/signup` if `localStorage` state ≠ `approved`.

**Mobile/tablet rules:**
- Marketing nav + app header both collapse to hamburger-triggered sheets below 768px
- Data tables (regulation frameworks, institutions cost, extensions map) stack to card-per-row on mobile
- Token dashboard tabs use `overflow-x-auto snap-x` to swipe through 5 triggers
- Inputs bump to 16px font below 640px (iOS zoom prevention)
- Meta stats on landing use `gap-px` + `bg-[#21262d]` backing to create `+` separators between 4 cells on mobile 2×2 grid; eyebrows forced to 2 visible lines via tuple-rendered `[line1, line2]` with `<br className="md:hidden" />`

---

## Environment Variables

```env
# REQUIRED
NEXT_PUBLIC_SOLANA_NETWORK=devnet

# RECOMMENDED (eliminates 429 rate limiting on public RPC)
# Browser-exposed — wallet adapter needs a reachable RPC.
# Lock the Helius key by allowed domains in the Helius dashboard.
NEXT_PUBLIC_RPC_ENDPOINT=https://devnet.helius-rpc.com/?api-key=YOUR_KEY

# OPTIONAL — enables drag-and-drop image upload
# PINATA_JWT is SERVER-ONLY. Uploads proxy through /api/ipfs/upload.
PINATA_JWT=your_jwt
NEXT_PUBLIC_PINATA_GATEWAY=gateway.pinata.cloud  # public — browser reads this for ipfs:// URLs

# OPTIONAL — backs the public /explorer catalog
# Populated automatically by Vercel Marketplace → Upstash for Redis integration.
# Code accepts UPSTASH_REDIS_REST_URL/_TOKEN as fallback for direct Upstash setups.
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

Helius free tier: https://helius.dev (1M credits/month)
Pinata free tier: https://app.pinata.cloud (1GB)
Upstash free tier: 10K commands/day (plenty for catalog traffic)

---

## Build Status

All Phase 1A through 1C milestones complete. `npm run build` + `npx tsc --noEmit` both pass clean on every commit.

| Phase | Scope | Status |
|---|---|---|
| **1A** | Dashboard MVP — wallet, token creation, onboarding, distribution, transfers, compliance, history, explorer lookup | Complete, verified on devnet |
| **1B** | Env hardening + Vercel deploy — Pinata server proxy, Helius origin lock, Upstash registry for /explorer catalog, server-side mint registration w/ on-chain verification | Complete, live on Vercel |
| **1C** | Marketing + gate — landing, institutions, regulation, FAQ, signup/KYC gate, RequireKyc wrapper, KycPill reset, faucet link refactor (in-app → faucet.solana.com) | Complete |
| **1D** | Design-system parity — AtlasLogo/Wordmark reusable, Polaris Crosshair favicon, PageHeader, unified canvas color, typography scale (all-Geist), wordmark attribution flip | Complete |
| **1E** | Mobile/tablet responsive — marketing nav drawer, app header drawer, responsive type sweep, table stacking, tabs overflow scroll, meta stats redesign, iOS zoom prevention, touch targets | Complete |
| **1F** | Demo polish — yield ticker (per-second accrual, BENJI-style), TokenAvatar (asset-type icons), sample data seeder (5 realistic tokens), Distributions tab (mint-to-holder pro-rata + equal-share, BUIDL mechanic) | Complete |
| **2** | Phase 1G demo refinements (atomic redemption, NAV display, compliance pre-trade simulator), Transfer Hook (Rust/Anchor), real KYC provider, mainnet | Not started — see `ROADMAP.md` |

### Phase 1A milestone detail

| Milestone | Status | Verified |
|---|---|---|
| 0 — Project Scaffold | Complete | Build clean |
| 1 — Wallet & Network | Complete | Phantom tested |
| 2 — Token Creation | Complete | Devnet verified (happy + stress paths) |
| 3 — Dashboard & Cap Table | Complete | On-chain data loads |
| 4 — Onboarding & Distribution | Complete | Mint + distribute tested with real wallet pair |
| 5 — P2P Transfer | Complete | Two-wallet send verified |
| 6 — Compliance Actions | Complete | Freeze/thaw/pause/burn all tested |
| 7 — Transaction History | Complete | Lightweight mode (devnet accommodation) |
| 8 — Demo Polish | Complete | Explorer catalog + backfill, integrity fixes |

---

## Architecture Decisions & Devnet Accommodations

Intentional MVP shortcuts with documented production upgrade paths. Each has inline comments pointing back here.

| Shortcut | File | Why | Production Fix |
|---|---|---|---|
| **localStorage for mint tracking** | `account-service.ts` | Public RPC blocks `getProgramAccounts` for Token-2022 | Upstash-backed registry is now the canonical path (see `/api/mints/list`). localStorage still used on `/tokens` for the issuer's own list. |
| **`getTokenLargestAccounts` for cap table** | `account-service.ts` | Same RPC limitation. Returns max 20 holders. | `getProgramAccounts` with paid RPC (Helius DAS API `getTokenAccounts`) for full pagination |
| **Lightweight transaction history** | `history-service.ts` | `getParsedTransactions` batch triggers 429 on public RPC | Switch to Helius Enhanced Transactions API or Webhook → DB |
| **Pinata for images** | `lib/pinata.ts` + `app/api/ipfs/*` | Free 1GB tier; server-proxy keeps JWT off the browser | Irys (Arweave) for permanent storage, or Pinata presigned upload JWTs to bypass Vercel's 4.5MB body limit |
| **Simulated KYC** | `lib/kyc.ts` + `signup-flow.tsx` | No real identity verification — 4s auto-approval | Civic Pass, Synaps, or Persona integration. Keep the 3-step wizard shape; swap step 2 for real doc verification. |
| **In-app airdrop removed** | `app-header.tsx` | `connection.requestAirdrop` unreliable on public and free-tier paid RPCs | Header link deep-links to `faucet.solana.com?walletAddress=<pk>`. Acceptable indefinitely — no in-app replacement needed. |

---

## Key Technical Patterns

### Transaction signing
All transactions go through `src/hooks/use-send-transaction.ts`:
1. Sets blockhash + feePayer
2. Pre-flight simulates against RPC (logs real Solana error to console)
3. Sends via wallet adapter with `signers` option for keypairs
4. Confirms with blockhash-based confirmation

### Token-2022 mint creation flow
`token-service.ts` → `createRwaToken()`:
1. Create account with `space = getMintLen(extensions)` only
2. Initialize extensions (MetadataPointer, DefaultAccountState, TransferFeeConfig, PermanentDelegate, PausableConfig)
3. Initialize mint
4. `SystemProgram.transfer` additional lamports to mint for metadata realloc
5. Initialize metadata (Token-2022 auto-reallocates using deposited lamports)
6. Update metadata fields (batched, max 3 per TX to stay under size limit)
7. Separate TX: create ATA + thaw + mint initial supply
8. Post-success: client POSTs mint + creator + metadata snapshot to `/api/mints/register` for catalog visibility

### Frozen account handling
Token-2022 `DefaultAccountState=Frozen` means ALL new token accounts start frozen. This affects:
- **Minting:** must thaw ATA before `MintTo` (Token-2022 blocks minting to frozen accounts)
- **Onboarding:** create ATA + thaw in one transaction
- **Transfers:** recipient must be thawed (validated client-side before sending)

### KYC gate
`lib/kyc.ts` holds `{ status: 'none' | 'pending' | 'approved', submittedAt, approvedAt, formData }` in `localStorage["ciphex-atlas-kyc"]`. `useKycStatus` subscribes via a custom `ciphex-atlas-kyc-changed` window event so same-tab updates propagate without relying on the browser's cross-tab `storage` event. `RequireKyc` redirects unapproved visitors to `/signup`. Submitting the form flips status to `pending`, a 4-second timer flips it to `approved`. Header `KycPill` shows the green badge with a 2-step "Reset KYC? yes / ×" confirm flow for demo resets.

### Distributions (Phase 1F)
On the token dashboard, the **Distributions** tab handles all yield/coupon/initial-allocation flows. Two modes:

| Mode | Math | Eligibility | Use case |
|---|---|---|---|
| `pro_rata` (default) | `(holderBalance / circulatingSupply) * totalAmount` | non-frozen, non-treasury, balance > 0 | Ongoing yield, coupons, dividends — BUIDL/BENJI mechanic |
| `equal` | `totalAmount / eligibleCount` | non-frozen, non-treasury (any balance) | Initial allocations and bootstrap distributions |

`distribution-service.ts → computeAllocations()` returns a previewable allocation map. Execution iterates over each holder and calls `mintToHolder()` (issuer's mint authority signs). Sequential, not batched — one wallet sign per recipient. Wallet rejection mid-run cleanly aborts and marks remaining holders as `skipped`. History persisted to `localStorage["ciphex-atlas-distributions-<mint>"]` per token; in production this should mirror to a Postgres `distribution_log` table for audit trails.

### Yield ticker (Phase 1F)
`<YieldTicker>` renders at the top of `/tokens/[mint]` and `/explorer/[mint]` when the token's metadata has any of: `coupon_rate`, `annual_yield`, `yield`, `apy`. Pure client-side computation: `supply × rate / (365 × 86400)` per second, ticking up. Resets at 00:00 UTC. Replicates Franklin BENJI's 2025 per-second accrual differentiator — research showed this is the single feature institutional buyers most consistently call out as a "lean forward" demo moment.

### Sample data seeder (Phase 1F)
`<SeedDemoButton>` lives in `/explorer` PageHeader actions slot. Eligible only on devnet + connected + KYC approved. Creates 5 realistic tokens (Treasury Note, REIT, private credit, gold, tech index) defined in `lib/demo-seeds.ts`, each with proper metadata including `coupon_rate` so the yield ticker fires. Real on-chain creation via `createRwaToken`, auto-registered in catalog via `useRegisterMint`. **Not idempotent** — running twice creates duplicates. Acceptable for demo workflow; would need a name-based dedupe check before production use.

### Mint registration
On successful token creation, `use-register-mint.ts` POSTs to `/api/mints/register` with `{ mint, creator, assetType, imageUri, description }`. The server route:
1. Verifies `PINATA_JWT` / Upstash creds present
2. Parses PublicKeys, validates
3. Fetches the mint account via `getMint(…, TOKEN_2022_PROGRAM_ID)`
4. Rejects with 403 if the claimed creator doesn't match the on-chain mint authority
5. Pulls `name` + `symbol` from on-chain metadata (not trusting client-supplied values)
6. Writes entry to Upstash: ZSET `atlas:mints:sorted` scored by `createdAt`, JSON blob at `atlas:mint:<address>`
Failure is non-fatal — the mint is on-chain regardless; `/explorer` just won't list it. Logs to console.

### Error handling contract
```
1. Works correctly with real data
2. Falls back visibly — clearly signals degraded mode
3. Fails with a clear error message
4. NEVER silently degrades to look "fine"
```
All errors use `TokenServiceError` with typed codes: `INSUFFICIENT_SOL`, `WALLET_REJECTED`, `NETWORK_ERROR`, `ACCOUNT_FROZEN`, `TOKEN_PAUSED`, `UNAUTHORIZED`, `INVALID_INPUT`, `ACCOUNT_NOT_FOUND`, `ALREADY_EXISTS`, `RPC_ERROR`.

---

## Vercel Deployment

### Configuration
- `next.config.ts` has no special flags — Vercel handles packaging natively
- Set **root directory** to `cipherion-tokenize` in Vercel project settings
- No Dockerfile, no TOML, no external DB — all state is either on-chain or in Upstash (managed by Vercel integration)

### Environment variables (set in Vercel project settings, apply to Prod + Preview + Dev)
```
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_RPC_ENDPOINT=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
PINATA_JWT=your_jwt                              # server-only
NEXT_PUBLIC_PINATA_GATEWAY=gateway.pinata.cloud
KV_REST_API_URL=<from Vercel Upstash integration>
KV_REST_API_TOKEN=<from Vercel Upstash integration>
```

### Helius Access Control gotchas
- Allowed Domains live under **RPCs → your endpoint → Access Control**, not under the API Keys page
- Helius **rejects `localhost`** as an allowed domain. For local dev, Allowed Domains must be **empty**.
- If any rule (Domains, IPs, or CIDRs) doesn't match the request source, every paid RPC method returns JSON-RPC error `-32401 Unauthorized`. `getHealth` still succeeds, which makes the failure look like a CORS or key issue — it isn't. Wipe all three rule fields to unblock local dev.
- Production: add only your Vercel production domain. Preview deploys need `*.vercel.app` (confirm Helius accepts wildcards on your plan) or leave rules empty.
- For zero key exposure, add an `/api/rpc` proxy route with a server-only `HELIUS_RPC_ENDPOINT` var. Not done yet — see `ROADMAP.md`.

---

## User Preferences (from memory)

- **No AI attribution in git commits** — never include `Co-Authored-By: Claude` or similar
- **Error handling: Fail Loud, Never Fake** — never silently swallow errors or substitute mock data
- **Brand:** CipheX Atlas (not "Cipherion Tokenize" — that's the directory name)
- **Token-2022 is the production program** — same on devnet and mainnet, not a "test version"
- **Document all devnet accommodations** — inline code comments + this doc, so an auditor understands every divergence from production patterns
- **Design:** all-Geist type system, GitHub-dark palette, Polaris Crosshair logo, no serif display

---

## Reference Documents

| Document | Purpose |
|---|---|
| `plans/ATLAS_HANDOFF.md` | This file — current state of the project |
| `plans/ROADMAP.md` | Remaining work, categorized by priority |
| `plans/RWA_TOKEN_PLATFORM_PROPOSAL.md` | Original research, chain comparison, architecture |
| `plans/RWA_TOKEN_PLATFORM_ADDENDUM.md` | Cost forecasts, competitive landscape, wallet compat |
| `plans/RWA_TOKEN_PLATFORM_IMPLEMENTATION_PLAN.md` | Milestone source of truth, shortcuts table |
| `plans/RWA_COUNTERPARTY_FAQ.md` | 40+ Q&A for stakeholder conversations, content writers |
