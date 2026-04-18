# CipheX Atlas — Agent Handoff Document

**Date:** 2026-04-17
**Purpose:** Complete context for a new coding agent to continue development. Copy-paste this into a new conversation.

---

## Project Summary

CipheX Atlas is an RWA (Real World Asset) token issuance and management platform built on Solana using Token-2022 (Token Extensions). It allows issuers to create compliance-enabled tokens, onboard investors with KYC gating, distribute tokens, and enforce compliance actions (freeze, thaw, pause, force burn) — all on-chain.

**Live on:** Solana Devnet (tokens are real on-chain, using test SOL)
**First token created:** "Test Fund A" — [VzZngWaHydAtKnXC4bT8b4WpvVJY1oG4VzB3eY97eiu](https://explorer.solana.com/address/VzZngWaHydAtKnXC4bT8b4WpvVJY1oG4VzB3eY97eiu?cluster=devnet)
**Stress test token created:** "CipheX Gold Reserve" (CXG) with all 5 extensions — verified working

---

## Repository Structure

```
abacus-trading-view/                    # Parent repo (trading view platform)
├── ciphex-predictions/                 # Existing trading dashboard (do NOT modify)
├── cipherion-tokenize/                 # CipheX Atlas app (THIS is our project)
│   ├── src/
│   │   ├── app/                        # Next.js App Router pages
│   │   │   ├── page.tsx                # Landing page
│   │   │   ├── create/page.tsx         # Token creation wizard
│   │   │   ├── tokens/page.tsx         # My Tokens list
│   │   │   ├── tokens/[mint]/page.tsx  # Token dashboard (tabbed)
│   │   │   ├── portfolio/page.tsx      # Investor portfolio + transfer
│   │   │   └── explorer/page.tsx       # Public token lookup
│   │   ├── components/
│   │   │   ├── wallet/                 # Wallet provider + connect button
│   │   │   ├── token/                  # Create wizard, mint form, stats, card
│   │   │   ├── holders/               # Cap table, onboard form
│   │   │   ├── transfer/              # Transfer form
│   │   │   ├── compliance/            # Freeze/thaw/pause/burn panel
│   │   │   ├── history/               # Transaction list + CSV export
│   │   │   ├── shared/                # Address display, explorer link, badges, etc.
│   │   │   └── ui/                    # shadcn/ui components
│   │   ├── hooks/                     # React hooks (wallet, tokens, transfers, etc.)
│   │   ├── lib/
│   │   │   ├── solana/                # All Solana RPC + Token-2022 operations
│   │   │   │   ├── token-service.ts   # Create, mint, transfer, getTokenInfo
│   │   │   │   ├── account-service.ts # Holders, onboarding, localStorage tracking
│   │   │   │   ├── compliance-service.ts # Freeze, thaw, pause, resume, burn
│   │   │   │   ├── metadata-service.ts   # Read on-chain metadata
│   │   │   │   ├── history-service.ts    # Transaction history
│   │   │   │   ├── connection.ts      # RPC connection singleton
│   │   │   │   ├── constants.ts       # Network config, program IDs
│   │   │   │   └── types.ts           # TokenServiceError, all type definitions
│   │   │   ├── pinata.ts             # IPFS image upload
│   │   │   └── utils/                # Format, validation, CSV helpers
│   │   ├── config/
│   │   │   └── asset-templates.ts    # 6 RWA asset type templates
│   │   └── types/
│   │       └── token.ts              # Re-exports from lib/solana/types
│   ├── .env.local                    # Environment variables (DO NOT COMMIT)
│   ├── .env.local.example            # Template for env vars
│   ├── next.config.ts                # output: "standalone" for Railway
│   ├── components.json               # shadcn/ui config (New York style)
│   └── package.json                  # Package: ciphex-atlas
├── plans/
│   ├── RWA_TOKEN_PLATFORM_PROPOSAL.md          # Research + architecture proposal
│   ├── RWA_TOKEN_PLATFORM_ADDENDUM.md          # Cost analysis, competitor landscape
│   ├── RWA_TOKEN_PLATFORM_IMPLEMENTATION_PLAN.md # Source of truth — milestones, acceptance criteria
│   ├── RWA_COUNTERPARTY_FAQ.md                 # 40+ Q&A for content writers/sales
│   └── ATLAS_HANDOFF.md                        # THIS FILE
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16.2.4, React 19, TypeScript strict |
| Styling | Tailwind CSS 4, shadcn/ui (New York), Radix UI, Lucide icons |
| Blockchain | Solana Token-2022 via @solana/web3.js + @solana/spl-token |
| Wallet | @solana/wallet-adapter-react (Phantom, Solflare, Backpack) |
| Image upload | Pinata IPFS (pinata-web3 SDK) |
| Fonts | Geist + Geist Mono (matches ciphex-predictions design) |
| Theme | Dark-only, GitHub-inspired palette (#0d1117, #161b22, #30363d, etc.) |

---

## Environment Variables

```env
# REQUIRED
NEXT_PUBLIC_SOLANA_NETWORK=devnet

# RECOMMENDED (eliminates 429 rate limiting on public RPC)
# Browser-exposed by design (wallet adapter needs a reachable RPC).
# Lock the Helius key to allowed origins in the Helius dashboard.
NEXT_PUBLIC_RPC_ENDPOINT=https://devnet.helius-rpc.com/?api-key=YOUR_KEY

# OPTIONAL — enables drag-and-drop image upload
# PINATA_JWT is SERVER-ONLY (no NEXT_PUBLIC_ prefix). Uploads proxy through
# /api/ipfs/upload so the JWT never reaches the browser.
PINATA_JWT=your_jwt
NEXT_PUBLIC_PINATA_GATEWAY=gateway.pinata.cloud  # read by both server route and browser
```

Helius free tier: https://helius.dev (1M credits/month)
Pinata free tier: https://app.pinata.cloud (1GB storage)

---

## Build Status

All 9 milestones complete. `npm run build` and `npx tsc --noEmit` both pass clean.

| Milestone | Status | Tested |
|-----------|--------|--------|
| 0 — Project Scaffold | Complete | Build clean |
| 1 — Wallet & Network | Complete | Phantom tested |
| 2 — Token Creation | Complete | Devnet verified (happy + stress paths) |
| 3 — Dashboard & Cap Table | Complete | On-chain data loads |
| 4 — Onboarding & Distribution | Complete | Mint to treasury tested, distribute tested |
| 5 — P2P Transfer | Complete | Built, needs two-wallet test |
| 6 — Compliance Actions | Complete | Freeze/thaw built, pause/resume wired |
| 7 — Transaction History | Complete | Lightweight mode (devnet accommodation) |
| 8 — Demo Polish | Complete | Explorer page, integrity fixes |

---

## Architecture Decisions & Devnet Accommodations

These are intentional MVP shortcuts with documented production upgrade paths. Each has inline code comments pointing to `plans/RWA_TOKEN_PLATFORM_IMPLEMENTATION_PLAN.md`.

| Shortcut | File | Why | Production Fix |
|----------|------|-----|---------------|
| **localStorage for mint tracking** | `account-service.ts` | Public RPC blocks `getProgramAccounts` for Token-2022 | Postgres table or Helius DAS API |
| **`getTokenLargestAccounts` for cap table** | `account-service.ts` | Same RPC limitation. Returns max 20 holders. | `getProgramAccounts` with paid RPC, or Helius DAS |
| **Lightweight transaction history** | `history-service.ts` | `getParsedTransactions` batch call triggers 429 on public RPC | Uncomment `getParsedTransactions` block with paid RPC, or Helius webhooks |
| **Pinata for images** | `lib/pinata.ts` + `app/api/ipfs/*` | Free 1GB tier; uploads proxy through server route (JWT stays server-side) | Irys (Arweave) for permanent storage, or Pinata presigned upload JWTs to bypass Vercel 4.5MB body limit |
| **Simulated KYC** | freeze/thaw model | No real identity verification | Civic Pass or Synaps integration |

---

## Known Gaps (Not Blocking Deploy)

### Gap 1: Transfer fee preview on transfer form
- **What:** When a token has TransferFeeConfig, the transfer form doesn't show the fee breakdown before sending. The fee still applies correctly on-chain.
- **Where:** `src/components/transfer/transfer-form.tsx`
- **Fix:** Read `TransferFeeConfig` from the mint via `getTransferFeeConfig()`, calculate `amount * bps / 10000`, display "Recipient receives X, fee: Y" before the confirm step.
- **Effort:** ~30 min

### Gap 2: MemoTransfer passthrough during onboarding
- **What:** The creation wizard has a "Memo Required (per account)" toggle. The code to enable it is wired in `account-service.ts` (`createAndThawAccount` accepts `enableMemo` param), but the onboard form UI doesn't pass the flag through the hook.
- **Where:** `src/components/holders/onboard-form.tsx` → `src/hooks/use-compliance.ts`
- **Fix:** Read token metadata for a `memo_required` flag (stored on-chain during creation if the toggle was ON), pass `enableMemo: true` to `createAndThawAccount`.
- **Effort:** ~30 min

### Gap 3: Explorer page is address-lookup only
- **What:** Requires full 44-char mint address. No browsable directory of tokens.
- **Where:** `src/app/explorer/page.tsx`
- **Fix (production):** Requires backend registry (Postgres or Helius DAS). List all tokens created through Atlas in a searchable catalog.
- **Effort:** 2-4 hours (with backend)

---

## Key Technical Patterns

### Transaction Signing
All transactions go through `src/hooks/use-send-transaction.ts`:
1. Sets blockhash + feePayer
2. Pre-flight simulates against RPC (logs real Solana error to console)
3. Sends via wallet adapter with `signers` option for keypairs
4. Confirms with blockhash-based confirmation

### Token-2022 Mint Creation Flow
`token-service.ts` → `createRwaToken()`:
1. Create account with `space = getMintLen(extensions)` only
2. Initialize extensions (MetadataPointer, DefaultAccountState, TransferFeeConfig, PermanentDelegate, PausableConfig)
3. Initialize mint
4. `SystemProgram.transfer` additional lamports to mint for metadata realloc
5. Initialize metadata (Token-2022 auto-reallocates using deposited lamports)
6. Update metadata fields (batched, max 3 per TX to stay under size limit)
7. Separate TX: create ATA + thaw + mint initial supply

### Frozen Account Handling
Token-2022 `DefaultAccountState=Frozen` means ALL new token accounts start frozen. This affects:
- **Minting:** Must thaw ATA before `MintTo` (Token-2022 blocks minting to frozen accounts)
- **Onboarding:** Create ATA + thaw in one TX
- **Transfers:** Recipient must be thawed (validated before sending)

### Error Handling Contract
```
1. Works correctly with real data
2. Falls back visibly — clearly signals degraded mode
3. Fails with a clear error message
4. NEVER: Silently degrades to look "fine"
```
All errors use `TokenServiceError` with typed codes: `INSUFFICIENT_SOL`, `WALLET_REJECTED`, `NETWORK_ERROR`, `ACCOUNT_FROZEN`, `TOKEN_PAUSED`, `UNAUTHORIZED`, `INVALID_INPUT`, `ACCOUNT_NOT_FOUND`, `ALREADY_EXISTS`, `RPC_ERROR`.

---

## Railway Deployment

### Configuration
- Deploy target is **Vercel**. `next.config.ts` has no special flags — Vercel handles packaging.
- Set **root directory** to `cipherion-tokenize` in Vercel project settings.
- No Dockerfile, no TOML, no Redis, no database needed.
- For Railway/Docker instead, re-add `output: "standalone"` to `next.config.ts`.

### Environment Variables (set in Vercel project settings)
```
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_RPC_ENDPOINT=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
PINATA_JWT=your_jwt                              # server-only
NEXT_PUBLIC_PINATA_GATEWAY=gateway.pinata.cloud  # shared by server route + browser
```

### Critical: Helius RPC is required for production
The public devnet RPC rate-limits at 100 req/10s. A deployed app serving concurrent users will hit 429s constantly. Helius free tier (1M credits/month) eliminates this entirely. Lock the key to your Vercel domain(s) in the Helius dashboard.

---

## Stress Test Results (2026-04-17)

Token: "CipheX Gold Reserve" (CXG), all 5 extensions enabled.
- Token creation with all extensions + image + metadata: PASS
- Initial supply minting (1M CXG with thaw-before-mint): PASS
- Dashboard loads on-chain data: PASS
- History tab loads with Helius RPC: PASS (was 429 on public RPC)
- Explorer page lookup: PASS
- Investor onboarding: NOT TESTED (needs second wallet)
- P2P transfer: NOT TESTED (needs second wallet)
- Compliance freeze/thaw/pause/burn: NOT TESTED (needs holders)

---

## Phase 1B (Not Started) — Transfer Hook

Custom Anchor/Rust program for advanced compliance (whitelist enforcement, jurisdiction checks, investor caps). Requires:
- Anchor framework setup in `programs/transfer-hook/`
- Rust development + deployment to devnet
- Frontend integration (whitelist management UI, Transfer Hook toggle in creation wizard)
- **This is the path to compliant DeFi** — the hook can validate both sides of a DEX swap

---

## Reference Documents

| Document | Purpose |
|----------|---------|
| `plans/RWA_TOKEN_PLATFORM_PROPOSAL.md` | Original research, chain comparison, architecture design |
| `plans/RWA_TOKEN_PLATFORM_ADDENDUM.md` | Cost forecasts, competitive landscape, wallet compatibility |
| `plans/RWA_TOKEN_PLATFORM_IMPLEMENTATION_PLAN.md` | Source of truth — milestones, acceptance criteria, MVP shortcuts table |
| `plans/RWA_COUNTERPARTY_FAQ.md` | 40+ Q&A for stakeholder conversations, content writers |

---

## User Preferences (from memory)

- **No Claude references in git commits** — never include `Co-Authored-By: Claude` or any attribution
- **Error handling: Fail Loud, Never Fake** — never silently swallow errors or substitute mock data
- **Brand:** CipheX Atlas (not "Cipherion Tokenize")
- **Design:** Must match ciphex-predictions look and feel (dark theme, Geist fonts, GitHub palette)
- **Token-2022 is the production program** — same on devnet and mainnet, not a "test version"
- **Document all devnet accommodations** — inline code comments + implementation plan table, so an auditor can understand every divergence from production patterns
