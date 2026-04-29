# CipheX Atlas — Agent Handoff Document

**Last updated:** 2026-04-23 (post Phase 2.B + remediation sprint)
**Purpose:** Complete context for a new coding agent. Copy-paste this into a new conversation. Companion to `KNOWLEDGEBASE.md` (active concerns + audit trail), `ROADMAP.md` (prioritized work), and `PRE_PRODUCTION_CHECKLIST.md` (ordered execution plan).

---

## Quick orientation for a new agent

If you read one section, read this one.

**What this is:** an RWA (Real World Asset) tokenization platform on Solana Token-2022. Issuers create compliance-enabled tokens, onboard investors, distribute yield, and enforce compliance actions — all on-chain. The UI is a dashboard sitting behind a public marketing shell and a mock KYC gate.

**Where we are:** Phases 1A–1G + Tracks A/B + Phase 2.B (server persistence for distributions + reconciliation + compliance-gated demo reset) are shipped on devnet. Deployed to Vercel. First real mint created on-chain at `VzZngWaHydAtKnXC4bT8b4WpvVJY1oG4VzB3eY97eiu` (devnet).

**What's next:** see `ROADMAP.md`. Phase 2 (Demo Completion, ~2 weeks) + Phase 3 (Pre-Production, ~6–8 weeks) + Phase 4 (Differentiation, post-mainnet).

**What's fragile:** see `KNOWLEDGEBASE.md` §1. Most important: authorities are NOT editable in the creation wizard despite docs that may claim otherwise (authority model is always "creator wallet").

**What's gated by on-chain vs off-chain:** see §"What is enforced on-chain vs off-chain" below. On-chain invariants are production-quality; off-chain state (KYC, route guards, rate limits) is demo-grade until Phase 3.

---

## Project Summary

CipheX Atlas is an RWA token issuance platform on Solana Token-2022 (Token Extensions). Issuers create compliance-enabled tokens, onboard investors with KYC gating, distribute tokens, and enforce compliance actions (freeze, thaw, pause, force burn). The dashboard is visually unified with the marketing shell: one type system, one color palette, Polaris Crosshair logo.

**Target market:** mid-market institutional issuers ($50–300M AUM), the gap below Securitize's enterprise pricing. See `MULTICHAIN_RESEARCH_2026-04.md` for the competitive positioning.

**Live on:** Solana Devnet (tokens real, using test SOL)
**Deployed to:** Vercel (preview + production)
**Marketing claim warning:** Landing page says "Live on Solana · Base · Avalanche · Ethereum." Product is Solana-only. Deliberate positioning; revisit for honesty in Phase 3 pre-production pass.

---

## Surface Map

### Public (no wallet, no KYC)

| Route | Purpose |
|---|---|
| `/` | Marketing landing — hero, five-pillar spotlight, proof-point quote, issuer market grid, CTA, full legal footer |
| `/institutions` | Institutional pitch — differentiators, cost-at-scale table, CTA |
| `/regulation` | Regulatory framework by jurisdiction + extension-to-requirement map + ERC-3643 mapping table (shipped Track B) |
| `/faq` | Split-persona FAQ: Issuers / Investors / Compliance / Technical |
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
| `/tokens/[mint]` | Token dashboard — Holders, Mint, Distributions, Reconciliation, Details, Compliance, History. Audit Pack export button in header. NAV update form (Track B). |
| `/portfolio` | Investor holdings + transfer + redemption |
| `/portfolio/[mint]` | Holder detail — position summary, yield on *my* balance, NAV, my distributions, transfer + redeem. Scoped transaction history on wallet ATA (Track B). |

### API

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/ipfs/upload` | POST | None (body size limits) | Pinata-backed image upload (server-side, JWT never sent to browser) |
| `/api/ipfs/status` | GET | None | Probe whether `PINATA_JWT` is configured |
| `/api/mints/register` | POST | Wallet signature + on-chain mint-authority check | Register a newly created mint in the Atlas catalog |
| `/api/mints/list` | GET | None | Read registered mints. `?creator=<wallet>` filter for "My Tokens" |
| `/api/distributions/record` | POST | Wallet signature + on-chain mint-authority check | **Phase 2.B** — append distribution record |
| `/api/distributions/list` | GET | None | Read records for a mint |
| `/api/reconciliation/register` | POST | Wallet signature + on-chain mint-authority check | **Phase 2.B** — upload/overwrite reconciliation register, atomic version bump |
| `/api/reconciliation/register` | GET | None | Read latest register |
| `/api/demo/reset` | POST | Wallet signature (not authority-gated) + 1/hr rate limit off devnet | **Phase 2.B** — wipe catalog + distributions + registers from Upstash |

`/api/mints/flush` was removed in Phase 2.B and replaced by `/api/demo/reset`.

---

## Repository Structure

```
abacus-trading-view/                           # Parent repo
├── ciphex-predictions/                        # Sibling product (do NOT modify)
├── cipherion-tokenize/                        # CipheX Atlas app (this project)
│   ├── src/
│   │   ├── app/
│   │   │   ├── icon.svg                       # Polaris favicon
│   │   │   ├── apple-icon.svg                 # iOS home-screen icon
│   │   │   ├── layout.tsx                     # Geist + Geist_Mono, AppShell
│   │   │   ├── page.tsx                       # Landing
│   │   │   ├── globals.css
│   │   │   ├── institutions/page.tsx
│   │   │   ├── regulation/page.tsx
│   │   │   ├── faq/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   ├── create/page.tsx
│   │   │   ├── tokens/page.tsx
│   │   │   ├── tokens/[mint]/page.tsx
│   │   │   ├── portfolio/page.tsx
│   │   │   ├── portfolio/[mint]/page.tsx
│   │   │   ├── explorer/page.tsx
│   │   │   ├── explorer/[mint]/page.tsx
│   │   │   └── api/
│   │   │       ├── ipfs/upload/route.ts
│   │   │       ├── ipfs/status/route.ts
│   │   │       ├── mints/register/route.ts
│   │   │       ├── mints/list/route.ts
│   │   │       ├── distributions/record/route.ts      # Phase 2.B
│   │   │       ├── distributions/list/route.ts        # Phase 2.B
│   │   │       ├── reconciliation/register/route.ts   # Phase 2.B
│   │   │       └── demo/reset/route.ts                # Phase 2.B
│   │   ├── components/
│   │   │   ├── auth/                          # RequireKyc guard, KycPill (wallet-signed reset)
│   │   │   ├── landing/
│   │   │   ├── faq/
│   │   │   ├── signup/
│   │   │   ├── wallet/
│   │   │   ├── token/                         # Create wizard, mint form, yield ticker, NAV display + update
│   │   │   ├── distribution/                  # DistributionForm (sign + server POST),
│   │   │   │                                  # DistributionHistory, PendingSyncBanner
│   │   │   ├── explorer/                      # SeedDemoButton
│   │   │   ├── holders/
│   │   │   ├── transfer/
│   │   │   ├── compliance/                    # ComplianceSimulator (5-rule engine), Compliance panel
│   │   │   ├── reconciliation/                # ReconciliationPanel (server-backed CSV diff)
│   │   │   ├── portfolio/                     # RedemptionDialog, MyDistributions
│   │   │   ├── history/
│   │   │   ├── shared/                        # AtlasLogo/Wordmark, PageHeader, AppShell, AppHeader,
│   │   │   │                                  # AuditPackButton, AddressDisplay, ExplorerLink,
│   │   │   │                                  # NetworkBadge, TokenAvatar
│   │   │   └── ui/                            # shadcn/ui primitives
│   │   ├── hooks/                             # use-kyc-status, use-send-transaction,
│   │   │                                      # use-token-*, use-transfer-fee,
│   │   │                                      # use-seed-demo, use-distributions (Phase 2.B)
│   │   ├── lib/
│   │   │   ├── api/                           # Phase 2.B
│   │   │   │   ├── schemas.ts                 # Zod: distributionRecord, registerUpload, walletAuth
│   │   │   │   ├── auth-message.ts            # buildSignatureMessage(purpose, mint, nonce, ts)
│   │   │   │   └── wallet-auth.ts             # verifyWalletSignature() — tweetnacl + nonce SETNX
│   │   │   ├── solana/
│   │   │   │   ├── token-service.ts
│   │   │   │   ├── account-service.ts
│   │   │   │   ├── compliance-service.ts
│   │   │   │   ├── distribution-service.ts
│   │   │   │   ├── metadata-service.ts
│   │   │   │   ├── history-service.ts
│   │   │   │   ├── connection.ts
│   │   │   │   ├── constants.ts
│   │   │   │   └── types.ts
│   │   │   ├── pinata.ts
│   │   │   ├── registry.ts                    # Upstash Redis client (server-only)
│   │   │   ├── kyc.ts                         # localStorage KYC + resetAllDemoData(auth)
│   │   │   ├── distributions.ts               # localStorage cache + server POST helpers
│   │   │   ├── reconciliation.ts              # Phase 2.B — extracted register load/save + server
│   │   │   ├── demo-seeds.ts
│   │   │   └── utils/                         # Format, validation, CSV, transfer-fee,
│   │   │                                      # audit-pack (ZIP), reconcile (diff engine)
│   │   ├── config/
│   │   │   └── asset-templates.ts
│   │   └── types/
│   │       └── token.ts
│   ├── .env.local.example
│   ├── next.config.ts
│   ├── components.json
│   ├── CLAUDE.md                              # Points at AGENTS.md
│   ├── AGENTS.md                              # Note: Next.js 16 has breaking changes — read dist/docs
│   └── package.json                           # ciphex-atlas
├── plans/
│   ├── ATLAS_HANDOFF.md                       # THIS FILE
│   ├── KNOWLEDGEBASE.md                       # Active concerns + audit trail (READ THIS)
│   ├── ROADMAP.md                             # Restructured Phase 2/3/4
│   ├── PRE_PRODUCTION_CHECKLIST.md            # Ordered execution plan with acceptance criteria
│   ├── RWA_TOKEN_PLATFORM_PROPOSAL.md         # Original architecture
│   ├── RWA_TOKEN_PLATFORM_ADDENDUM.md         # Cost forecasts, competitors, wallet compat
│   ├── RWA_TOKEN_PLATFORM_IMPLEMENTATION_PLAN.md
│   ├── RWA_COUNTERPARTY_FAQ.md                # 40+ Q&A for stakeholder conversations
│   ├── TRACK_A_PROPOSAL.md                    # Track A spec (shipped, historical)
│   ├── DEMO_SCRIPT.md                         # Needs refresh for Track A/B + Phase 2.B
│   └── MULTICHAIN_RESEARCH_2026-04.md
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 16.2.4** (App Router, Turbopack) — read `node_modules/next/dist/docs/` for breaking changes from pre-16 knowledge |
| Runtime | React 19, TypeScript strict |
| Styling | Tailwind CSS 4, shadcn/ui (New York), Radix UI, Lucide icons |
| Fonts | Geist + Geist Mono via `next/font/google` — no serif display face |
| Blockchain | Solana Token-2022 via `@solana/web3.js` + `@solana/spl-token` |
| Wallet | `@solana/wallet-adapter-react` (Phantom, Solflare, Backpack) |
| Crypto (auth) | `tweetnacl` for Ed25519 signature verification (Phase 2.B) |
| IPFS | `pinata-web3` SDK (server-side only, proxied) |
| KV/Cache | Upstash Redis (Vercel Marketplace integration) |
| Validation | Zod (Phase 2.B routes) |
| Theme | Dark-only. Canvas `#0a0e13`, borders `#30363d`, accents green/blue/yellow/red |

---

## Build Status

`npm run build` + `npx tsc --noEmit` both pass clean on every commit. No test suite yet (Phase 2.D.1).

| Phase | Scope | Status |
|---|---|---|
| **1A** | Dashboard MVP — wallet, token creation, onboarding, distribution, transfers, compliance, history, explorer lookup | Complete, devnet-verified |
| **1B** | Env hardening + Vercel deploy — Pinata proxy, Helius origin lock, Upstash catalog | Complete |
| **1C** | Marketing + gate — landing, institutions, regulation, FAQ, signup/KYC gate | Complete |
| **1D** | Design-system parity — AtlasLogo/Wordmark, Polaris favicon, PageHeader, all-Geist typography | Complete |
| **1E** | Mobile/tablet responsive | Complete |
| **1F** | Demo polish — yield ticker, TokenAvatar, sample data seeder, Distributions tab (mint-to-holder BUIDL mechanic) | Complete |
| **1G** | `/tokens` → Upstash KV, redemption simulator, NAV display, accrual record on yield ticker, seeder idempotency, demo reset | Complete |
| **Track A** | Compliance simulator (5 rules), audit pack ZIP, reconciliation panel, holder detail view, landing overhaul | Complete |
| **Track B** | NAV mutation on-chain, scoped history on `/portfolio/[mint]`, ERC-3643 table on `/regulation`, `pillars-test` removed, `sample-register.csv` added | Complete |
| **Phase 2.B** | Server-persisted distributions + reconciliation + wallet-signed demo reset (see §"Server Persistence") | Complete 2026-04-23 |
| **Phase 2 (remaining)** | Squads multisig option, jurisdiction rule in simulator, Chain Advisor, chain abstraction refactor, test baseline, DEMO_SCRIPT + DESIGN_SYSTEM docs, console.log cleanup | Not started — see `ROADMAP.md` §2 |
| **Phase 3** | Supabase backend, real KYC (Persona), accredited verification, server-side guards, `/api/rpc` proxy, Squads enforcement, mainnet | Not started — see `PRE_PRODUCTION_CHECKLIST.md` |
| **Phase 4** | Transfer Hook, EVM (Base → Polygon → Avalanche), waterfall, capital calls, tax reporting, OTC/RFQ, ATS integrations | Not started — see `ROADMAP.md` §4 |

---

## Authority Model

**Critical for anyone writing docs or demo scripts.** The code and the older docs have drifted on this.

### How authorities are actually assigned today

Every authority on every Atlas-created mint is hardcoded to the **connected wallet at creation time**. The creation wizard does NOT expose pubkey inputs for any authority. The Step 3 "Supply & Authorities" panel is a **read-only display** labeled "Authorities (auto-assigned)" showing "Your wallet" for each role.

| Authority | Assignment | Editable in wizard |
|---|---|---|
| Mint authority | `payer` (connected wallet) at `token-service.ts:199` | No |
| Freeze authority | `payer` at `token-service.ts:200` | No |
| Pause authority | `payer` at `token-service.ts:188` | No |
| Permanent delegate | `publicKey` at `create-wizard.tsx:126` when the compliance toggle is on; otherwise undefined | No — only the boolean toggle |
| Metadata update authority | `payer` at `token-service.ts:222` | No |

### What this means in practice

- **No Squads multisig as authority at creation.** The wizard has no pubkey input. A determined issuer can deploy via `@solana/spl-token` directly with a Squads authority and register the mint through `POST /api/mints/register`, but that is outside what Atlas produces.
- **No authority rotation post-creation.** Solana supports it (`setAuthority` instruction). Atlas has no UI. Phase 2.A.3 on the roadmap.
- **No separate cold-storage authority.** If your hot wallet is compromised, authorities on any Atlas-created mint rotate with it.
- **Institutional posture is missing.** A fund admin's insurance carrier will reject single-key. This is a known Phase 2 gap.

### On-chain authority checks (in server routes)

`/api/distributions/record` and `/api/reconciliation/register` call `getMint()` and check that the signing wallet equals the on-chain `mintAuthority`. This IS a real authority gate — but because creator = mint authority in every current Atlas flow, "mint authority" and "creator" are interchangeable today. That coupling breaks whenever Phase 2.A.1 lands and authorities diverge.

---

## What is enforced on-chain vs off-chain

### Enforced by Solana (production-quality today)

- **Mint authority** — only the keypair can mint. No bypass.
- **Freeze authority** — only the keypair can freeze/thaw.
- **Permanent delegate** — only the delegate can force-transfer/burn.
- **Pausable** — pause/unpause gated by pause authority.
- **DefaultAccountState=Frozen** — all new accounts created frozen; must be thawed.
- **Transfer fees** — basis-point fee deducted by program on every transfer.
- **Metadata authority** — only the update authority can mutate on-chain metadata.

### Enforced by Atlas server (Phase 2.B, wallet-signed)

- **Distribution record write** — wallet signature + mint-authority check.
- **Reconciliation register write** — wallet signature + mint-authority check + atomic version bump.
- **Demo reset** — wallet signature (any wallet, not authority-gated) + rate limit off devnet.
- **Replay protection** — nonce `SETNX` with 10-minute TTL; 5-minute timestamp window.
- **Structured logs** — every write includes `actor: wallet` for attribution.

### Not enforced (demo-grade — hardens in Phase 3)

- **Who can reach `/tokens/[mint]`** — URL-based. Non-authorities can view the admin UI; their compliance actions just get rejected by Solana.
- **KYC state** — localStorage only. `<RequireKyc>` is a client-side redirect, trivially bypassable.
- **Rate limits on mutating routes (broadly)** — only `/api/demo/reset` has one, and only off devnet.
- **Jurisdiction** — metadata field only; not read by any enforcement path (Phase 2.A.2 adds simulator enforcement; Phase 4 Transfer Hook adds runtime enforcement).
- **GET routes** — no auth on any read route. Distribution history and registers are publicly readable.
- **Pending-sync state** — `serverSync: "pending"` markers live in localStorage only; rejected server-persist signs don't follow the wallet across devices.

---

## Server Persistence Patterns (Phase 2.B)

### Write flow (distribution record + register upload)

1. Client builds record/payload.
2. Client generates `nonce = crypto.randomUUID()`, `timestamp = Date.now()`.
3. Client builds signed message via `buildSignatureMessage(purpose, mint, nonce, timestamp)` → format: `atlas-<purpose>|<mint>|<nonce>|<timestamp>`.
4. Client calls `wallet.signMessage()` → base64-encodes signature.
5. Client POSTs `{ auth: { wallet, nonce, timestamp, signature }, record/entries }` to the route.
6. Server validates with Zod (`lib/api/schemas.ts`).
7. Server calls `verifyWalletSignature(auth, purpose, mint)`:
   - Reject if `|now - timestamp| > 5 min`.
   - Parse wallet pubkey, decode base64 signature.
   - `nacl.sign.detached.verify(messageBytes, sigBytes, walletPk.toBytes())`.
   - `SETNX atlas:nonce:<nonce>` with 10-min TTL. Reject on replay.
   - Unless `skipReplayCheck: true`, reject with 503 if registry unconfigured (fail-loud).
8. For distribution/register routes: `getMint(mint)` and check `mintAuthority.equals(walletPk)`.
9. Execute atomic write:
   - **Distribution:** `SETNX atlas:dist:<mint>:id:<id>` with SHA-256 canonical-hash value (dedup guard) → `LPUSH atlas:dist:<mint>` + `ZADD atlas:dist:idx`.
   - **Register:** `INCR atlas:reg:<mint>:version` → `SET atlas:reg:<mint>` with `{ version, uploadedAt, uploadedBy, entries }` + `ZADD atlas:reg:idx`.
10. Structured log: `console.info({ event, chain, mint, id, actor, ... })`.

### Read flow (hooks)

- **`useDistributions(mint)`** — returns localStorage cache immediately, fetches server in background, merges (server authoritative, localStorage-pending prepended), backfills cache.
- **`fetchDistributionsFromServer(mint)`** — direct async server fetch, used by audit pack export.
- **`loadDistributions(mint)`** — sync localStorage-only reader; used where loading state is unacceptable (yield ticker, audit-pack fallback path).
- **Reconciliation panel** — loads server first, falls back to localStorage; saves write-through to both.

### Failure modes (fail-loud)

- Upstash unconfigured → 503 from write routes with clear message; reads return empty arrays.
- Server POST fails → optimistic localStorage write stands, `serverSync: "pending"` flag set, yellow banner appears with auto-retry on mount + manual retry button.
- Audit pack fallback → if server unreachable, reads localStorage but prepends `# LOCAL CACHE — server unavailable, verify against chain` warning in the CSV + README.

### Dedup semantics

- Same `id` with same payload (canonical-hash match) → 200 `{ ok: true, dedup: true }`.
- Same `id` with different payload → 409 Conflict.
- **Caveat:** `canonicalHash` at `distributions/record/route.ts:17–20` sorts only top-level keys. Nested objects rely on V8 insertion order — deterministic in practice but fragile to refactors. Recursive canonical stringify is a 10-minute fix recommended alongside test baseline (Phase 2.D.1).

---

## Key Technical Patterns (pre-2.B)

### Transaction signing

All Solana transactions go through `src/hooks/use-send-transaction.ts`:
1. Sets blockhash + feePayer.
2. Pre-flight simulates against RPC (logs Solana error to console — part of the 21 `console.log`s flagged in Phase 2.D.3 cleanup).
3. Sends via wallet adapter with `signers` option for keypairs.
4. Confirms with blockhash-based confirmation.

### Token-2022 mint creation flow

`token-service.ts → createRwaToken()`:
1. Create account with `space = getMintLen(extensions)`.
2. Initialize each extension (MetadataPointer, DefaultAccountState, TransferFeeConfig, PermanentDelegate, PausableConfig).
3. Initialize mint (all authorities set to `payer` — see Authority Model above).
4. `SystemProgram.transfer` additional lamports to mint for metadata realloc.
5. Initialize metadata (Token-2022 auto-reallocates).
6. Update metadata fields (batched, max 3 per TX).
7. Separate TX: create ATA + thaw + mint initial supply.
8. Post-success: client POSTs to `/api/mints/register`.

### Frozen account handling

Token-2022 `DefaultAccountState=Frozen` means ALL new token accounts start frozen. Affects:
- **Minting:** must thaw ATA before `MintTo`.
- **Onboarding:** create ATA + thaw in one tx (freeze-authority action).
- **Transfers:** recipient must be thawed (validated client-side pre-send).

### KYC gate

`lib/kyc.ts` holds `{ status: 'none' | 'pending' | 'approved', submittedAt, approvedAt, formData }` in `localStorage["ciphex-atlas-kyc"]`. `useKycStatus` subscribes via `ciphex-atlas-kyc-changed` CustomEvent. `RequireKyc` redirects unapproved to `/signup`. Submitting flips to `pending`; 4-second timer flips to `approved`. Header `KycPill` shows green badge with 2-step "Reset demo?" confirm.

**Reset flow (Phase 2.B):** KycPill signs `buildSignatureMessage("demo-reset", "global", nonce, ts)`, passes auth to `resetAllDemoData(auth)`. The "yes" button is **disabled until wallet is connected** (no more silent-divergence reset). Wallet-rejection leaves state untouched.

### Distributions (Phase 1F)

Two allocation modes:

| Mode | Math | Eligibility | Use case |
|---|---|---|---|
| `pro_rata` (default) | `(holderBalance / circulatingSupply) * totalAmount` | non-frozen, non-treasury, balance > 0 | Ongoing yield, coupons — BUIDL/BENJI mechanic |
| `equal` | `totalAmount / eligibleCount` | non-frozen, non-treasury (any balance) | Initial allocations, bootstrap |

`distribution-service.ts → computeAllocations()` returns previewable allocation map. Execution iterates and calls `mintToHolder()`. Sequential, not batched — one wallet sign per recipient. Wallet rejection mid-run aborts cleanly, remaining holders marked `skipped`. Phase 2.B adds one more wallet sign at the end for the server-persistence message.

### Yield ticker (Phase 1F/1G)

`<YieldTicker>` renders at top of `/tokens/[mint]` and `/explorer/[mint]` when metadata has any of `coupon_rate`, `annual_yield`, `yield`, `apy`. Pure client-side: `supply × rate / (365 × 86400)` per second. Resets at 00:00 UTC. On `/portfolio/[mint]`, `balanceOverride={holding.balance}` makes accrual show *my* position.

### Compliance pre-trade simulator (Track A)

`<ComplianceSimulator>` on Compliance tab. Input: wallet address. Output: green/red verdict + per-rule breakdown. **5 rules today** (token paused, account frozen, investor onboarded, investor cap, distribution eligibility). Phase 2.A.2 adds rule 6 (jurisdiction). Pure client-side — no RPC.

### Audit pack (Track A, upgraded Phase 2.B)

`<AuditPackButton>` downloads `Atlas_Audit_Pack_{SYMBOL}_{DATE}.zip`. Contents: `holders.csv`, `transactions.csv` (up to 500 via `fetchAllTransactions`, `TX_CAP = 500`, `MAX_TX_PAGES = 50`), `distributions.csv` (**server-first via `fetchDistributionsFromServer`**, localStorage fallback with warning row), `token_metadata.json`, `README.txt`.

### Reconciliation (Track A, upgraded Phase 2.B)

`<ReconciliationPanel>` tab. CSV upload or clipboard paste. `reconcile()` in `lib/utils/reconcile.ts` is a pure function returning `DiffRow[]` with types: match, balance_mismatch, status_mismatch, both_mismatch, missing_onchain, missing_register. **Register persists to server + localStorage cache** (Phase 2.B). Version + uploadedBy included in diff CSV filename and header row. Missing-on-chain rows have an "Onboard" action (ATA create + thaw).

### Holder detail view (Track A)

`/portfolio/[mint]` — investor-facing detail. Differences from `/tokens/[mint]`: no cap table, no compliance actions, no reconciliation. `YieldTicker` with `balanceOverride`. `<MyDistributions>` filters records to connected wallet. Transfer + redeem-at-NAV buttons.

### Mint registration

`use-register-mint.ts` POSTs to `/api/mints/register` with `{ input: { mint, assetType, imageUri, description }, auth: { wallet, nonce, timestamp, signature } }`. Server:
1. Zod-validates input + auth.
2. `verifyWalletSignature(auth, "register-mint", mint)` — ed25519 sig + nonce replay + timestamp window.
3. `getMint(…, TOKEN_2022_PROGRAM_ID)`.
4. Rejects 403 if `auth.wallet` ≠ on-chain mint authority.
5. Pulls `name` + `symbol` from on-chain metadata (not client-supplied).
6. Writes ZSET `atlas:mints:sorted` (scored by `createdAt`) + JSON at `atlas:mint:<address>`.

Failure non-fatal — mint is on-chain regardless; `/explorer` just won't list it.

### Error handling contract

```
1. Works correctly with real data
2. Falls back visibly — clearly signals degraded mode
3. Fails with a clear error message
4. NEVER silently degrades to look "fine"
```

All errors use `TokenServiceError` with typed codes: `INSUFFICIENT_SOL`, `WALLET_REJECTED`, `NETWORK_ERROR`, `ACCOUNT_FROZEN`, `TOKEN_PAUSED`, `UNAUTHORIZED`, `INVALID_INPUT`, `ACCOUNT_NOT_FOUND`, `ALREADY_EXISTS`, `RPC_ERROR`.

---

## Architecture Decisions & Devnet Accommodations

| Shortcut | File | Why | Production Fix |
|---|---|---|---|
| localStorage for mint tracking (fallback) | `account-service.ts` | Public RPC blocks `getProgramAccounts` for Token-2022 | Upstash catalog is canonical via `/api/mints/list`. localStorage still used on `/tokens` as cache. |
| `getTokenLargestAccounts` for cap table | `account-service.ts` | Public RPC limitation. Max 20 holders. | Helius DAS `getTokenAccounts` for full pagination |
| Lightweight transaction history | `history-service.ts` | `getParsedTransactions` batch 429s on public RPC | Helius Enhanced Transactions API or Webhook → DB |
| Pinata for images | `lib/pinata.ts` + `app/api/ipfs/*` | Free 1GB tier; server-proxy keeps JWT off browser | Irys (Arweave) or Pinata presigned uploads |
| Simulated KYC | `lib/kyc.ts` + `signup-flow.tsx` | No real identity verification — 4s auto-approval | **Persona (recommended), Synaps, or Civic** (Phase 3 — `PRE_PRODUCTION_CHECKLIST.md` §3.B) |
| localStorage for pending-sync flags | `lib/distributions.ts` | No session model; Phase 3 Supabase will carry per-user state | Supabase row marking sync status |
| Demo reset not authority-gated | `/api/demo/reset` | Devnet demo UX — any connected wallet can reset | Phase 3 admin-role-only action |
| In-app airdrop removed | `app-header.tsx` | `requestAirdrop` unreliable | Header deep-links to `faucet.solana.com?walletAddress=<pk>`. Acceptable indefinitely. |

---

## Design System Summary

**Logo:** Polaris Crosshair — concentric circles + 45°-rotated four-pointed star + white center dot. Rendered by `AtlasLogo` / `AtlasWordmark`. Favicon at `src/app/icon.svg`, iOS at `apple-icon.svg`.

**Wordmark lock:** `Atlas | BY CIPHEX` — "Atlas" in Geist Semibold, "BY CIPHEX" in Geist Mono 9–10px uppercase with `border-l`. `compact` prop bumps sizing for dense nav.

**Typography scale (all Geist Sans + Geist Mono):**

| Element | Mobile | Tablet | Desktop |
|---|---|---|---|
| Marketing hero h1 | 40px | 56px | 80px |
| Institutions / Regulation hero | 36px | 52px | 68px |
| FAQ / Signup h1 | 32px | 44px | 60/44px |
| Marketing section h2 | 26–28px | 30–32px | 36–40px |
| Dashboard page title | 24px | 28px | 32px |
| Mono eyebrow | 10px | 11px | 11px |
| Body lead | 14–15px | 16–17px | 17–19px |
| Body | 13–14px | 14px | 14–15px |
| Pull quote | 22px | 26px | 32px (sans) |

Display type: `font-semibold`, tight tracking (`-0.03em` to `-0.04em`). Emphasis via green color accent (`#3fb950`). No italics.

**Shared primitives:** `PageHeader`, `MarketingNav/Footer`, `AppHeader`, `RequireKyc`, `KycPill`, `AtlasLogo`, `AtlasWordmark`, `TokenAvatar`, `AddressDisplay`, `ExplorerLink`, `NetworkBadge`, `MetaStat`, `Pillar`, `Row`, `CostCard`. `DESIGN_SYSTEM.md` pending (Phase 2.E.2).

**Mobile/tablet rules:**
- Marketing nav + app header collapse to hamburger sheets below 768px
- Tables stack to cards on mobile (cap table, regulation, extensions, cost)
- Token dashboard tabs `overflow-x-auto snap-x` for 5 triggers (now 6 with Reconciliation)
- Inputs bump to 16px font below 640px (iOS zoom prevention)

---

## Environment Variables

```env
# REQUIRED
NEXT_PUBLIC_SOLANA_NETWORK=devnet

# RECOMMENDED
# Browser-exposed — wallet adapter needs reachable RPC.
# Lock by allowed domains in Helius dashboard. Phase 3 moves this server-side behind /api/rpc.
NEXT_PUBLIC_RPC_ENDPOINT=https://devnet.helius-rpc.com/?api-key=YOUR_KEY

# OPTIONAL — enables drag-and-drop image upload
# SERVER-ONLY. Uploads proxy through /api/ipfs/upload.
PINATA_JWT=your_jwt
NEXT_PUBLIC_PINATA_GATEWAY=gateway.pinata.cloud

# OPTIONAL — backs /explorer catalog + Phase 2.B server persistence
# Auto-populated by Vercel Marketplace → Upstash for Redis integration.
# Code accepts UPSTASH_REDIS_REST_URL/_TOKEN fallback.
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

Helius free tier: https://helius.dev (1M credits/month). Pinata free tier: https://app.pinata.cloud (1GB). Upstash free tier: 10K commands/day.

**Note:** No `DEMO_ADMIN_KEY` — that pattern was proposed during Phase 2.B design but dropped in favor of wallet-signed auth (no server secret to leak). See `KNOWLEDGEBASE.md` §2 for the decision trail.

---

## Vercel Deployment

### Configuration
- `next.config.ts` has no special flags
- Set **root directory** to `cipherion-tokenize` in Vercel project settings
- No Dockerfile, no external DB — all state on-chain or in Upstash

### Environment variables (Prod + Preview + Dev)
```
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_RPC_ENDPOINT=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
PINATA_JWT=your_jwt
NEXT_PUBLIC_PINATA_GATEWAY=gateway.pinata.cloud
KV_REST_API_URL=<from Vercel Upstash integration>
KV_REST_API_TOKEN=<from Vercel Upstash integration>
```

### Helius Access Control gotchas
- Allowed Domains live under **RPCs → your endpoint → Access Control**, not API Keys
- Helius **rejects `localhost`** as an allowed domain. For local dev: Allowed Domains must be empty.
- If any rule (Domains, IPs, CIDRs) doesn't match, every paid RPC method returns JSON-RPC `-32401 Unauthorized`. `getHealth` still succeeds — makes the failure look like CORS.
- Production: only your Vercel production domain + `*.vercel.app` for previews (confirm wildcard support on your plan).
- Phase 3 replaces browser RPC key with `/api/rpc` proxy.

---

## User Preferences (from memory)

- **No AI attribution in git commits** — never include `Co-Authored-By: Claude`.
- **Error handling: Fail Loud, Never Fake** — never silently swallow errors or substitute mock data.
- **Brand:** CipheX Atlas (not "Cipherion Tokenize" — that's the directory).
- **Token-2022 is the production program** — same on devnet and mainnet, not a "test version."
- **Document all devnet accommodations** — inline code comments + this doc.
- **Design:** all-Geist type system, GitHub-dark palette, Polaris Crosshair logo, no serif display.

---

## Reference Documents

| Document | Purpose |
|---|---|
| `plans/ATLAS_HANDOFF.md` | **This file** — evergreen state of the project |
| `plans/KNOWLEDGEBASE.md` | **Read this too** — active concerns, session audit trail, fragile spots |
| `plans/ROADMAP.md` | Prioritized remaining work. Phase 2/3/4 structure. |
| `plans/PRE_PRODUCTION_CHECKLIST.md` | Ordered execution plan with acceptance criteria |
| `plans/RWA_TOKEN_PLATFORM_PROPOSAL.md` | Original architecture, chain comparison |
| `plans/RWA_TOKEN_PLATFORM_ADDENDUM.md` | Cost forecasts, competitive landscape, wallet compat |
| `plans/RWA_COUNTERPARTY_FAQ.md` | 40+ Q&A for stakeholder conversations |
| `plans/TRACK_A_PROPOSAL.md` | Track A spec (shipped) |
| `plans/DEMO_SCRIPT.md` | 30–45 min walkthrough — **needs refresh for Track A/B + Phase 2.B** (Phase 2.E.1) |
| `plans/MULTICHAIN_RESEARCH_2026-04.md` | Multi-chain expansion research (Base, Polygon, Avalanche, ERC-3643) |

---

## Suggested first moves for a new agent

1. Read `KNOWLEDGEBASE.md` cover-to-cover — that's the active-concerns doc.
2. Skim `ROADMAP.md` §2 (Demo Completion) and §9 (Next-session priorities).
3. Verify the authority model claim by opening `supply-step.tsx` and `token-service.ts:184–203`. Don't trust older docs on authority editability.
4. Pick one of:
   - **Canonical-hash depth fix** (10 min, alongside test baseline) — described in `KNOWLEDGEBASE.md` §1.
   - **Pure-function test baseline (Phase 2.D.1)** — 2 days. Covers `reconcile`, `audit-pack`, compliance simulator, `distribution-service`. Natural place to add the canonical-hash test.
   - **Chain Advisor flow (Phase 2.C.1)** — 2 days, highest demo-narrative unlock.
   - **Chain abstraction refactor (Phase 2.C.2)** — 3–5 days, invisible to users, unblocks Phase 4 EVM work.
5. Before touching Solana code, read `AGENTS.md` — Next.js 16 has breaking changes from pre-16 training data.
