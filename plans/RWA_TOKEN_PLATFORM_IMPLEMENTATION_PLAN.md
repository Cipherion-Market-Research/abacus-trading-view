# CipheX Atlas — Implementation Plan (Source of Truth)

**Date:** 2026-04-17
**Status:** Phase 1A Complete — All 9 milestones built and building clean
**Companion Docs:** `RWA_TOKEN_PLATFORM_PROPOSAL.md`, `RWA_TOKEN_PLATFORM_ADDENDUM.md`, `RWA_COUNTERPARTY_FAQ.md`

> This document is the guiding truth for all coding agents. Every milestone has acceptance criteria.
> Every architectural decision is final unless explicitly revised in this document.
> Reference research docs for context/rationale — reference THIS doc for what to build.

### Build Completion Summary (2026-04-17)

| Milestone | Status | Verified |
|-----------|--------|----------|
| 0 — Project Scaffold | Complete | Build clean, TypeScript strict |
| 1 — Wallet & Network | Complete | Phantom connect tested |
| 2 — Token Creation | Complete | Token created on devnet ([explorer](https://explorer.solana.com/address/VzZngWaHydAtKnXC4bT8b4WpvVJY1oG4VzB3eY97eiu?cluster=devnet)) |
| 3 — Dashboard & Cap Table | Complete | On-chain data loads correctly |
| 4 — Onboarding & Distribution | Complete | Mint to treasury tested, thaw-before-mint working |
| 5 — P2P Transfer | Complete | Built, needs two-wallet test |
| 6 — Compliance Actions | Complete | Freeze/thaw/pause/burn wired with real SDK instructions |
| 7 — Transaction History | Complete | Lightweight mode (rate-limit accommodation) |
| 8 — Demo Polish | Complete | Explorer page, integrity fixes, airdrop fix |
| Phase 1B — Transfer Hook | Not started | Deferred — requires Anchor/Rust |

**Devnet accommodations documented:** 5 items in the "Known MVP Shortcuts" table below, each with inline code comments pointing back to this document and specific production upgrade instructions.

---

## Table of Contents

1. [Guiding Principles](#1-guiding-principles)
2. [Architecture Specification](#2-architecture-specification)
3. [Design System Contract](#3-design-system-contract)
4. [Milestone 0 — Project Scaffold](#4-milestone-0--project-scaffold)
5. [Milestone 1 — Wallet & Network Foundation](#5-milestone-1--wallet--network-foundation)
6. [Milestone 2 — Token Creation Engine](#6-milestone-2--token-creation-engine)
7. [Milestone 3 — Token Dashboard & Cap Table](#7-milestone-3--token-dashboard--cap-table)
8. [Milestone 4 — Investor Onboarding & Distribution](#8-milestone-4--investor-onboarding--distribution)
9. [Milestone 5 — Peer-to-Peer Transfer](#9-milestone-5--peer-to-peer-transfer)
10. [Milestone 6 — Compliance Actions Panel](#10-milestone-6--compliance-actions-panel)
11. [Milestone 7 — Transaction History & Audit Export](#11-milestone-7--transaction-history--audit-export)
12. [Milestone 8 — Demo Polish & Scenario Runner](#12-milestone-8--demo-polish--scenario-runner)
13. [Phase 1B — Transfer Hook Program](#13-phase-1b--transfer-hook-program)
14. [Human-in-the-Loop Requirements](#14-human-in-the-loop-requirements)
15. [Agentic vs Human Work Breakdown](#15-agentic-vs-human-work-breakdown)
16. [Deployment Architecture](#16-deployment-architecture)
17. [File Tree Specification](#17-file-tree-specification)
18. [Dependency Manifest](#18-dependency-manifest)
19. [Error Handling Contract](#19-error-handling-contract)
20. [Testing Strategy](#20-testing-strategy)

---

## 1. Guiding Principles

### Error Handling: Fail Loud, Never Fake

```
Priority Order:
1. Works correctly with real data
2. Falls back visibly — clearly signals degraded mode (banner, toast, console warning)
3. Fails with a clear error message
4. NEVER: Silently degrades to look "fine"
```

- No try/catch blocks that swallow errors without user-visible feedback
- No fallback to mock/placeholder data without a visible degraded-mode indicator
- Every blockchain transaction must surface success/failure with tx signature or error detail
- Every RPC call must handle: network error, rate limit, timeout, invalid response — each with distinct user-facing messaging

### Code Quality

- TypeScript strict mode, no `any` types
- No unnecessary abstractions — three similar lines > one premature helper
- No speculative features or "nice-to-have" additions beyond milestone scope
- Components own their data fetching via hooks — no prop drilling beyond 2 levels
- All Solana operations go through `lib/solana/` service layer — components never import `@solana/web3.js` directly

### Deployment Independence

- This app MUST be independently deployable — zero imports from `ciphex-predictions`
- Shared design system is achieved by copying config (not importing), so the two apps can diverge
- Environment variables control network (devnet/mainnet) and RPC endpoint
- No database dependency for MVP — all state is on-chain

---

## 2. Architecture Specification

```
┌──────────────────────────────────────────────────────────────────┐
│                    cipherion-tokenize (Next.js 16)               │
│                                                                   │
│  src/app/                    src/lib/solana/                      │
│  ┌──────────────┐            ┌──────────────────────┐            │
│  │  Pages &     │───hooks───▶│  Service Layer       │            │
│  │  Components  │            │                      │            │
│  │              │◀──state────│  token-service.ts     │            │
│  └──────────────┘            │  account-service.ts   │            │
│         │                    │  compliance-service.ts │            │
│         │                    │  metadata-service.ts   │            │
│         ▼                    │  history-service.ts    │            │
│  src/components/             │  connection.ts         │            │
│  ┌──────────────┐            └──────────┬───────────┘            │
│  │  UI (shadcn) │                       │                        │
│  │  Token       │                       ▼                        │
│  │  Wallet      │            ┌──────────────────────┐            │
│  │  Compliance  │            │  @solana/wallet-      │            │
│  │  Transfer    │            │  adapter-react        │            │
│  └──────────────┘            └──────────┬───────────┘            │
│                                         │                        │
└─────────────────────────────────────────┼────────────────────────┘
                                          │
                                 ┌────────▼────────┐
                                 │  Solana Devnet   │
                                 │  Token-2022      │
                                 │  Program         │
                                 └─────────────────┘
```

### Layers (Strict Boundaries)

| Layer | Responsibility | Can Import |
|-------|---------------|------------|
| `src/app/` (pages) | Route handling, page-level layout | `components/`, `hooks/` |
| `src/components/` | UI rendering, user interaction | `hooks/`, `lib/utils`, `ui/` |
| `src/hooks/` | State management, data fetching, mutations | `lib/solana/`, `@solana/wallet-adapter-react` |
| `src/lib/solana/` | All Solana RPC + Token-2022 operations | `@solana/web3.js`, `@solana/spl-token` |
| `src/lib/utils/` | Pure utility functions | Nothing project-specific |
| `src/components/ui/` | shadcn primitives | Only Radix, CVA, cn() |

### State Management

- **Wallet state:** `@solana/wallet-adapter-react` context (publicKey, sendTransaction, connected)
- **Token data:** React hooks with `useState` + manual refetch after mutations. No global state library.
- **Form state:** React `useState` within wizard components. No form library unless complexity demands it.
- **On-chain data is the source of truth.** UI reads from chain, writes to chain. No local cache beyond React state.

---

## 3. Design System Contract

Copied from `ciphex-predictions` — NOT imported. These are the rules for visual consistency:

### Theme

- **Dark-only.** HTML root: `className="dark"`. No light mode, no toggle.
- **Fonts:** Geist (sans) + Geist Mono (mono) via `next/font/google`
- **Colors:** GitHub-inspired dark palette:

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-base` | `#0d1117` | Page background |
| `--bg-card` | `#161b22` | Cards, panels, sidebar |
| `--bg-card-elevated` | `#21262d` | Nested cards, hover states |
| `--text-primary` | `#f0f6fc` | Primary text |
| `--text-secondary` | `#8b949e` | Muted/secondary text |
| `--border` | `#30363d` | Card borders, dividers |
| `--border-hover` | `#484f58` | Hover borders |
| `--success` | `#3fb950` | Confirmed, KYC approved, tx success |
| `--success-dark` | `#238636` | Success backgrounds |
| `--danger` | `#f85149` | Errors, frozen, failed tx |
| `--warning` | `#d29922` | Pending, caution |
| `--info` | `#58a6ff` | Informational, links |
| `--accent-purple` | `#a371f7` | Accents, highlights |
| `--accent-teal` | `#00BCD4` | Secondary accent |

### Component Library

- **Base:** shadcn/ui (New York style) + Radix UI primitives
- **Icons:** lucide-react
- **Variants:** class-variance-authority (CVA)
- **Class merging:** `cn()` from `clsx` + `tailwind-merge`
- **Border radius:** `rounded-lg` (8px) for cards, `rounded-md` (6px) for inputs/buttons
- **Shadows:** Minimal — prefer borders over elevation. `shadow-sm` max.

### Layout

- **Desktop-first** with mobile responsiveness at `md` (768px) breakpoint
- **Sidebar layout** for token dashboard (300px fixed width, left border)
- **Full-width layout** for creation wizard and portfolio
- **Max content width:** None specified — full viewport width with padding

### Typography Scale

| Element | Classes |
|---------|---------|
| Page title | `text-xl font-semibold text-[#f0f6fc]` |
| Section header | `text-sm font-semibold text-[#f0f6fc] uppercase tracking-wider` |
| Body text | `text-sm text-[#f0f6fc]` |
| Secondary text | `text-sm text-[#8b949e]` |
| Label (small caps) | `text-[11px] uppercase tracking-wider text-[#8b949e]` |
| Monospace data | `font-mono text-sm font-semibold text-[#f0f6fc]` |
| Address/hash | `font-mono text-xs text-[#8b949e]` |

### Status Badges

| Status | Background | Text |
|--------|-----------|------|
| Active / Approved | `bg-[rgba(63,185,80,0.15)]` | `text-[#3fb950]` |
| Pending / Frozen | `bg-[rgba(210,153,34,0.15)]` | `text-[#d29922]` |
| Error / Rejected | `bg-[rgba(248,81,73,0.15)]` | `text-[#f85149]` |
| Info / Default | `bg-[rgba(88,166,255,0.15)]` | `text-[#58a6ff]` |
| Paused | `bg-[rgba(163,113,247,0.15)]` | `text-[#a371f7]` |

---

## 4. Milestone 0 — Project Scaffold

### Scope
Set up the project structure, tooling, and design system foundation. Zero blockchain logic.

### Deliverables
1. Next.js 16 app initialized with TypeScript strict mode
2. Tailwind CSS 4 configured with the dark theme from Section 3
3. Geist + Geist Mono fonts loaded
4. shadcn/ui initialized (New York style, neutral base color)
5. Core UI components installed: Button, Card, Input, Select, Tooltip, Popover, Separator, Badge, Dialog, Tabs, Table
6. `cn()` utility in `lib/utils.ts`
7. `globals.css` with full color system, scrollbar hiding, safe area utilities
8. App layout with dark mode enforced
9. Placeholder pages for all routes (create, tokens, tokens/[mint], portfolio, explorer)
10. `.env.local` with `NEXT_PUBLIC_SOLANA_NETWORK=devnet` and `NEXT_PUBLIC_RPC_ENDPOINT`
11. `package.json` with all dependencies listed in Section 18
12. `.gitignore` properly configured
13. README with setup instructions

### Acceptance Criteria
- [ ] `npm run dev` starts without errors
- [ ] All placeholder pages render with correct dark theme
- [ ] Fonts render as Geist sans/mono
- [ ] shadcn Button, Card, Input render correctly
- [ ] No TypeScript errors (`npx tsc --noEmit` passes)
- [ ] Project directory is self-contained — no imports from `../ciphex-predictions/`
- [ ] `.env.local.example` documents all required env vars

### Agentic: 100%
No human input needed. Fully scriptable.

---

## 5. Milestone 1 — Wallet & Network Foundation

### Scope
Wallet connection, network awareness, devnet SOL faucet, and the Solana service layer skeleton.

### Deliverables
1. `src/components/wallet/wallet-provider.tsx` — ConnectionProvider + WalletProvider + WalletModalProvider wrapping the app
2. `src/components/wallet/connect-button.tsx` — Custom-styled wallet connect button matching design system (not default adapter UI)
3. `src/lib/solana/connection.ts` — Singleton connection factory, reads from env, validates network
4. `src/hooks/use-network.ts` — Hook exposing network name, explorer URL builder, connection health
5. Network indicator in the header (shows "Devnet" badge with warning color when not mainnet)
6. Devnet SOL airdrop button (visible only on devnet) with loading state and success/error toast
7. Wallet balance display (SOL) in header
8. `src/lib/solana/token-service.ts` — Skeleton with function signatures, no implementation
9. `src/lib/solana/account-service.ts` — Skeleton
10. `src/lib/solana/compliance-service.ts` — Skeleton
11. Toast notification system (success, error, warning, info) — reusable across all milestones

### Acceptance Criteria
- [ ] Phantom wallet connects and shows truncated address + SOL balance
- [ ] Solflare wallet connects (if installed)
- [ ] Disconnect works cleanly — UI resets to "Connect Wallet" state
- [ ] Devnet airdrop button requests 1 SOL and balance updates after confirmation
- [ ] Airdrop failure shows clear error toast (rate limit, network error, etc.)
- [ ] Network badge shows "Devnet" in warning color
- [ ] No wallet connected → all token pages show "Connect wallet to continue" state (not blank, not error)
- [ ] `connection.ts` handles RPC errors with typed error messages (not silent failures)
- [ ] Toast notifications work for success, error, warning, info variants

### Agentic: 95%
**Human needed:** Test with physical Phantom/Solflare wallet extensions to verify UX. Agent can build and unit test but cannot interact with browser wallet extensions.

---

## 6. Milestone 2 — Token Creation Engine

### Scope
Multi-step wizard that creates a Token-2022 mint with configurable extensions and on-chain metadata.

### Deliverables

1. **Wizard UI** — 5-step form:
   - Step 1: Basic Info (name, symbol, decimals, asset type, description, image URI)
   - Step 2: Compliance Config (KYC gating toggle, transfer fees toggle/config, pausable toggle, permanent delegate toggle, memo required toggle)
   - Step 3: Supply & Authorities (initial supply, mint authority, freeze authority, permanent delegate pubkey)
   - Step 4: Metadata (key-value editor with pre-populated fields based on asset type)
   - Step 5: Review & Confirm (summary card, estimated SOL cost, create button)

2. **`lib/solana/token-service.ts` — `createRwaToken()`** — Full implementation:
   - Calculates required extensions from config
   - Computes mint account size via `getMintLen()`
   - Calculates rent-exempt balance
   - Builds transaction: CreateAccount → InitializeExtensions (in correct order) → InitializeMint → InitializeMetadata → (optional) MintTo
   - Returns: `{ mint: PublicKey, signature: string }`

3. **`hooks/use-token-create.ts`** — Mutation hook wrapping `createRwaToken()` with loading/error/success state

4. **Asset type templates** — JSON presets for: Treasury, Real Estate, Equity, Debt, Fund, Commodity
   - Pre-fill metadata fields (NAV, maturity, coupon, custodian, ISIN, etc.)
   - Pre-select sensible compliance defaults per type

5. **Cost estimator** — Real-time SOL cost display on the review step, calculated from actual `getMintLen()` + `getMinimumBalanceForRentExemption()`

### Acceptance Criteria
- [ ] Wizard navigates forward/back without losing state
- [ ] Form validation: name required, symbol required (2-10 chars, uppercase), decimals 0-9, at least one authority set
- [ ] Selecting asset type pre-fills metadata template
- [ ] Transfer fee config: basis points 0-10000, max fee required when enabled
- [ ] Review step shows all selected parameters accurately
- [ ] Cost estimate matches actual transaction cost (within 10%)
- [ ] "Create Token" sends transaction via wallet adapter
- [ ] **Success:** Toast with mint address, link to Solana Explorer, redirect to token dashboard
- [ ] **Failure:** Toast with specific error (insufficient SOL, wallet rejected, network error). Form state preserved — user can retry without re-entering data.
- [ ] Created mint is verifiable on Solana Explorer (devnet) with correct metadata, extensions, and supply
- [ ] Token with DefaultAccountState=Frozen extension: verify new ATAs start frozen
- [ ] Token with TransferFeeConfig: verify fee config matches input
- [ ] Token with Pausable: verify pausable authority is set

### Agentic: 85%
**Human needed:** Wallet interaction testing (sign transaction prompts). Verify created token on Solana Explorer. Agent can build all code, write integration tests against `solana-test-validator`, and implement the full wizard UI.

---

## 7. Milestone 3 — Token Dashboard & Cap Table

### Scope
Issuer-facing dashboard showing token details, supply stats, and holder list.

### Deliverables

1. **Token list page** (`/tokens`) — Grid/list of all Token-2022 mints where connected wallet is mint authority or freeze authority
   - Card per token: name, symbol, supply, holder count, status badge
   - Uses `getProgramAccounts` filtered by authority

2. **Token dashboard** (`/tokens/[mint]`) — Single token management view:
   - Header: name, symbol, mint address (copy button), Explorer link
   - Stats row: Total Supply, Circulating Supply, Holder Count, KYC Approved Count, Token Status (Active/Paused)
   - Tabbed interface: Overview | Holders | Mint & Distribute | Compliance | History | Settings

3. **Cap table** (Holders tab):
   - Table columns: Wallet (truncated + copy), Balance, % of Supply, Account Status (Active/Frozen), Actions
   - Fetches all token accounts for this mint via `getProgramAccounts`
   - Status badge per holder: Active (green), Frozen (warning), New/Pending (info)
   - Search/filter by address

4. **`lib/solana/account-service.ts`** — Implementation:
   - `getTokenHolders(mint)` — Returns all token accounts with owner, balance, frozen state
   - `getTokenInfo(mint)` — Returns mint info, metadata, extensions, authorities
   - `getTokensForAuthority(authority)` — Returns mints where wallet is mint/freeze authority

5. **`hooks/use-token-info.ts`**, **`hooks/use-holders.ts`** — Query hooks with refresh capability

### Acceptance Criteria
- [ ] Token list shows all tokens created by connected wallet
- [ ] Clicking a token navigates to `/tokens/[mint]` dashboard
- [ ] Stats row shows accurate supply and holder data from on-chain state
- [ ] Cap table lists all holders with correct balances and frozen/active status
- [ ] Cap table updates after any mutation (mint, transfer, freeze) — manual refresh button at minimum
- [ ] Empty states: "No tokens created yet" / "No holders yet" — not blank, not error
- [ ] Mint address is copyable (click to copy with feedback)
- [ ] Explorer link opens correct Solana Explorer page (devnet cluster)
- [ ] Loading states: skeleton/shimmer on all data-dependent sections while RPC calls are in flight
- [ ] RPC errors: clear error message with retry button — not silent failure

### Agentic: 90%
**Human needed:** Visual review of dashboard layout, verify cap table data accuracy against Explorer.

---

## 8. Milestone 4 — Investor Onboarding & Distribution

### Scope
Create token accounts for investor wallets, approve KYC (thaw), mint new supply, and distribute tokens.

### Deliverables

1. **Onboard form** (`/tokens/[mint]/onboard`):
   - Input: investor wallet address (pubkey validation)
   - Action: Create ATA + thaw (if DefaultAccountState=Frozen)
   - Batch mode: textarea for multiple addresses (one per line)
   - Shows result per address: success (ATA address) or error (invalid pubkey, already exists, etc.)

2. **Mint form** (Mint & Distribute tab):
   - Input: amount to mint
   - Recipient: treasury (default) or specific wallet address
   - Respects decimal precision of the token

3. **Distribution form:**
   - Select recipient from cap table (dropdown/autocomplete of known holders)
   - Input: amount
   - Optional: memo (if MemoTransfer enabled)
   - Shows estimated fee (if TransferFeeConfig enabled)

4. **`lib/solana/token-service.ts`** additions:
   - `mintTokens(mint, amount, destination?)` — Mint to treasury or specific ATA
   - `transferTokens(mint, to, amount, memo?)` — Transfer with TransferFeeConfig awareness
   - `createAndThawAccount(mint, owner)` — Create ATA + thaw in single transaction

5. **`lib/solana/account-service.ts`** additions:
   - `getOrCreateAta(mint, owner)` — Idempotent ATA creation
   - `isAccountFrozen(mint, owner)` — Check freeze status

### Acceptance Criteria
- [ ] Onboard single investor: ATA created, account thawed (if frozen default), cap table updates
- [ ] Onboard duplicate investor: shows "already onboarded" — not an error, not a re-creation
- [ ] Batch onboard: processes N addresses, shows per-row success/failure
- [ ] Invalid pubkey input: validation error before transaction attempt
- [ ] Mint tokens: supply increases, treasury balance updates
- [ ] Mint 0 tokens: form validation prevents submission
- [ ] Distribute tokens: sender balance decreases, recipient balance increases
- [ ] Distribute to non-onboarded wallet: clear error — "Recipient does not have a token account"
- [ ] Distribute to frozen wallet: clear error — "Recipient account is frozen"
- [ ] Transfer fee display: when TransferFeeConfig is enabled, show "Recipient will receive X (fee: Y)" before confirmation
- [ ] All mutations update cap table without full page reload

### Agentic: 85%
**Human needed:** Wallet interaction testing (multiple transactions in sequence). Verify on Explorer.

---

## 9. Milestone 5 — Peer-to-Peer Transfer

### Scope
Investor-facing transfer flow: send tokens from connected wallet to another address.

### Deliverables

1. **Portfolio page** (`/portfolio`):
   - Lists all Token-2022 tokens held by connected wallet
   - Per token: name, symbol, balance, issuer info, KYC status (frozen/active)
   - "Transfer" button per token

2. **Transfer form:**
   - Select token (if multiple held)
   - Recipient address input (pubkey validation)
   - Amount input (respects decimals, max = balance)
   - Memo input (if MemoTransfer enabled for this token; required indicator if enforced)
   - Fee preview (if TransferFeeConfig enabled)
   - Confirmation step with summary before signing

3. **`hooks/use-portfolio.ts`** — Fetches all Token-2022 token accounts for connected wallet

### Acceptance Criteria
- [ ] Portfolio shows all Token-2022 tokens with correct balances
- [ ] Transfer to onboarded wallet: succeeds, balances update on both sides
- [ ] Transfer to frozen wallet: clear error — "Recipient account is frozen"
- [ ] Transfer from frozen account: clear error — "Your account is frozen for this token"
- [ ] Transfer when token is paused: clear error — "Token is currently paused"
- [ ] Transfer with fee: shows fee breakdown before signing, correct amounts after tx
- [ ] Transfer with required memo: form enforces memo field when MemoTransfer is enabled
- [ ] Amount validation: cannot exceed balance, cannot be 0, respects decimal places
- [ ] "Max" button sets amount to full balance
- [ ] Confirmation step shows: from, to, amount, fee (if any), memo (if any)
- [ ] Success: toast with tx signature link
- [ ] Failure: preserves form state, shows error, allows retry

### Agentic: 85%
**Human needed:** Two-wallet testing (send from Wallet A, verify receipt in Wallet B). Wallet interaction testing.

---

## 10. Milestone 6 — Compliance Actions Panel

### Scope
Issuer-facing controls for freeze, thaw, pause, unpause, and forced operations.

### Deliverables

1. **Compliance tab** on token dashboard:
   - **Token-level controls:**
     - Pause/Unpause toggle (if Pausable enabled) with confirmation dialog
     - Token status indicator (Active / Paused)
   - **Account-level controls** (per holder in cap table):
     - Freeze button → confirmation dialog → freezes account
     - Thaw button → confirmation dialog → thaws account
   - **Permanent Delegate actions** (if enabled):
     - Force burn: select account, enter amount, confirmation dialog with strong warning
     - (Force transfer: select source, destination, amount — optional, can defer)

2. **`lib/solana/compliance-service.ts`** — Full implementation:
   - `freezeAccount(mint, account)`
   - `thawAccount(mint, account)`
   - `pauseToken(mint)` / `unpauseToken(mint)`
   - `forceBurn(mint, account, amount)` — via PermanentDelegate
   - `forceTransfer(mint, from, to, amount)` — via PermanentDelegate (stretch)

3. **Confirmation dialogs** for all destructive actions:
   - Freeze: "This will prevent [address] from sending or receiving [TOKEN]"
   - Pause: "This will halt ALL transfers, minting, and burning for [TOKEN]"
   - Force burn: "This will permanently destroy [amount] [TOKEN] from [address]. This cannot be undone."
   - Must type token symbol to confirm destructive actions

### Acceptance Criteria
- [ ] Freeze account → account shows as frozen in cap table → holder cannot transfer
- [ ] Thaw account → account shows as active → holder can transfer again
- [ ] Pause token → token status shows "Paused" → all transfers fail with clear error
- [ ] Unpause token → token status shows "Active" → transfers resume
- [ ] Force burn → holder balance decreases, total supply decreases
- [ ] All actions require confirmation dialog — no single-click destructive actions
- [ ] Force burn requires typing token symbol to confirm
- [ ] Non-authority wallet cannot see or execute compliance actions
- [ ] Authority check: only freeze authority sees freeze/thaw, only mint authority sees mint, etc.
- [ ] Each action shows success toast with tx signature or failure toast with error detail

### Agentic: 85%
**Human needed:** Verify that frozen accounts genuinely cannot transact (test with second wallet). Wallet interaction testing.

---

## 11. Milestone 7 — Transaction History & Audit Export

### Scope
On-chain transaction history for a token, filterable and exportable.

### Deliverables

1. **History tab** on token dashboard:
   - Paginated list of transactions for this mint
   - Columns: Time, Type (Mint/Transfer/Freeze/Thaw/Burn/Pause), From, To, Amount, Signature (link)
   - Type icons/colors matching status badge system
   - Filter by type

2. **`lib/solana/history-service.ts`**:
   - `getTokenTransactions(mint, options?)` — Uses `getSignaturesForAddress` + `getParsedTransaction`
   - Parses Token-2022 instructions into human-readable event types
   - Handles pagination (before/after cursors)

3. **Audit export:**
   - "Export CSV" button
   - Columns: Timestamp, Type, From Address, To Address, Amount, Fee, Memo, Tx Signature, Block
   - Client-side CSV generation (no server needed)

### Acceptance Criteria
- [ ] History shows all token operations in chronological order (newest first)
- [ ] Each entry correctly identified as Mint, Transfer, Freeze, Thaw, Burn, Pause, etc.
- [ ] Signature links open correct Solana Explorer transaction page
- [ ] Pagination works — "Load more" fetches next page
- [ ] Filter by type works (show only transfers, show only compliance actions, etc.)
- [ ] CSV export downloads a file with all visible transactions
- [ ] CSV data matches on-screen data exactly
- [ ] Empty state: "No transactions yet" — not blank
- [ ] Loading state while fetching history — skeleton rows or spinner

### Agentic: 95%
**Human needed:** Verify transaction parsing accuracy against Solana Explorer (spot check 5-10 transactions).

---

## 12. Milestone 8 — Demo Polish & Scenario Runner

### Scope
Polish for counterparty demos. Asset templates, guided demo mode, and UX refinements.

### Deliverables

1. **Landing page** (`/`):
   - Cipherion branding
   - Brief RWA tokenization explainer (2-3 sentences)
   - "Connect Wallet" CTA
   - Quick stats after connection: wallet balance, tokens created, tokens held

2. **Asset templates** (pre-built configs):
   - Treasury Bill Fund
   - Real Estate Share
   - Private Equity Token
   - Commodity-Backed Token
   - Each template pre-fills: name pattern, metadata fields, compliance defaults, description

3. **Explorer page** (`/explorer`):
   - Search by mint address
   - Public view of any token: name, symbol, supply, holder count, metadata, extension info
   - No wallet connection required

4. **Demo quality-of-life:**
   - Copy-paste buttons on all addresses and signatures
   - Toast notifications stack correctly (max 3 visible)
   - Loading states on every async operation
   - Empty states on every list/table
   - Error states on every data fetch
   - Mobile-responsive layouts for all pages (at least functional, not broken)

5. **Solana Explorer integration:**
   - All mint addresses link to `explorer.solana.com/?cluster=devnet`
   - All transaction signatures link to explorer
   - All wallet addresses link to explorer

### Acceptance Criteria
- [ ] Full demo scenario runs end-to-end without errors (see Proposal doc, Section 9 for script)
- [ ] Landing page renders correctly with and without wallet connected
- [ ] All 4+ asset templates produce valid tokens with sensible defaults
- [ ] Explorer page shows public token info for any valid mint address
- [ ] Invalid mint address on explorer: clear "Token not found" message
- [ ] No page in the app shows a blank/white screen under any state (loading, empty, error, disconnected)
- [ ] All addresses are copy-paste enabled
- [ ] Mobile: no horizontal scroll, no overlapping elements, functional navigation
- [ ] Page load time < 3 seconds on devnet (excluding RPC latency)

### Agentic: 90%
**Human needed:** Full demo run-through with real wallets. Visual polish review. Mobile testing on physical device.

---

## 13. Phase 1B — Transfer Hook Program

### Scope
Custom Anchor program enforcing whitelist-based transfer compliance. **Separate milestone, not blocking Phase 1A launch.**

### Deliverables

1. **Anchor program** (`programs/transfer-hook/`):
   - Transfer Hook interface implementation
   - Whitelist registry (PDA per mint → set of approved addresses)
   - `add_to_whitelist(mint, address)` instruction
   - `remove_from_whitelist(mint, address)` instruction
   - Hook logic: reject transfer if sender OR recipient is not on whitelist

2. **Frontend integration:**
   - Whitelist management UI on compliance tab
   - Token creation wizard gains "Transfer Hook" toggle (creates token with hook program ID)
   - Transfer error messages updated for hook rejections

3. **Tests:**
   - Anchor test suite: whitelist add/remove, transfer allowed, transfer rejected
   - Integration test: end-to-end token lifecycle with hook

### Acceptance Criteria
- [ ] Program deploys to devnet without errors
- [ ] Token created with Transfer Hook: transfers between whitelisted addresses succeed
- [ ] Token created with Transfer Hook: transfers involving non-whitelisted address fail with clear error
- [ ] Whitelist management UI: add/remove addresses, list shows current whitelist
- [ ] Hook does not break wallet adapter transaction building (extra accounts resolved correctly)

### Agentic: 70%
**Human needed:** Anchor/Rust development may need human guidance if agent struggles with Solana program architecture. Program deployment and testing on devnet. Security review of hook logic.

---

## 14. Human-in-the-Loop Requirements

### Decisions Needed Before Development Starts

| Decision | Options | Recommendation | Blocking? |
|----------|---------|---------------|-----------|
| App name / directory | `cipherion-tokenize`, `rwa-platform`, other | `cipherion-tokenize` | Yes — Milestone 0 |
| Branding | Cipherion, sub-brand, white-label | Cipherion sub-brand | No — Milestone 8 |
| Demo wallet strategy | Pre-generated keypairs vs real wallets | Real wallets for authenticity | No — Milestone 8 |
| RPC provider for devnet | Public endpoint vs Helius Free | Public for dev, Helius for demo | No — Milestone 1 |
| Deploy target | Railway vs AWS vs Vercel | Vercel (fastest for Next.js) | No — Milestone 8 |

### Human Required During Development

| Activity | When | Why Agent Can't Do It |
|----------|------|----------------------|
| Wallet extension testing | Milestones 1-6 | Browser wallet interaction requires human clicking "Approve" in extension |
| Two-wallet transfer testing | Milestones 4-5 | Need two separate browser profiles with different wallets |
| Demo run-through | Milestone 8 | End-to-end scenario with 3 personas requires human orchestration |
| Visual polish review | Milestone 8 | Subjective design quality assessment |
| Mobile testing | Milestone 8 | Physical device interaction |
| Anchor program review | Phase 1B | Security-sensitive Rust code benefits from human audit |
| Deployment configuration | Post-build | Environment variables, DNS, secrets management |

---

## 15. Agentic vs Human Work Breakdown

### Summary

| Category | Agentic | Human |
|----------|---------|-------|
| Project scaffolding | 100% | 0% |
| UI component development | 95% | 5% (visual review) |
| Solana service layer | 90% | 10% (wallet testing) |
| Hook/form logic | 95% | 5% |
| Token-2022 integration | 85% | 15% (on-chain verification) |
| Transfer Hook (Rust) | 70% | 30% (architecture guidance, security review) |
| Testing (unit/integration) | 90% | 10% (manual wallet tests) |
| Demo polish | 80% | 20% (visual, UX judgment calls) |
| Deployment | 60% | 40% (secrets, DNS, provider accounts) |
| **Overall MVP (Phase 1A)** | **~88%** | **~12%** |

### What the Agent Builds Autonomously

- All TypeScript/React code
- All Solana service layer functions
- All UI components and pages
- All hooks and state management
- All form validation logic
- Unit tests (vitest)
- Integration tests against `solana-test-validator`
- CSS/styling matching design system
- Placeholder data for loading/empty/error states
- CSV export logic
- Route structure and navigation

### What Requires Human

- Wallet extension approve/reject testing
- Multi-wallet scenario testing
- Verifying on-chain state matches UI (spot checks via Solana Explorer)
- Design quality sign-off per milestone
- Anchor/Rust Transfer Hook architecture decisions (Phase 1B)
- Production deployment configuration
- Demo rehearsal with real wallets

---

## 16. Deployment Architecture

### Development
```
localhost:3000 → Next.js dev server
  └── Solana Devnet (api.devnet.solana.com)
```

### Staging / Demo
```
cipherion-tokenize.vercel.app (or Railway)
  └── Solana Devnet (Helius devnet RPC)
```

### Production (Phase 2+)
```
tokenize.cipherion.com (or similar)
  └── Solana Mainnet-Beta (Helius mainnet RPC)
```

### Environment Variables

```env
# Required
NEXT_PUBLIC_SOLANA_NETWORK=devnet          # devnet | mainnet-beta
NEXT_PUBLIC_RPC_ENDPOINT=                  # Custom RPC URL (optional, falls back to public)

# Optional (Phase 1B)
NEXT_PUBLIC_TRANSFER_HOOK_PROGRAM_ID=      # Custom program address

# Optional (Phase 2)
NEXT_PUBLIC_HELIUS_API_KEY=                # For enhanced RPC features
```

### Known MVP Shortcuts → Production Migration Path

These are intentional simplifications made for the MVP/demo. Each has a clear upgrade path.

| Shortcut | Why (MVP) | Production Fix | Effort |
|----------|-----------|---------------|--------|
| **localStorage for mint tracking** | Avoids scanning all Token-2022 accounts on devnet (too slow, rate-limited) | **Tier 1:** Postgres table (`mints`: mint_address, creator_wallet, created_at). Single API route, single table. **Tier 2:** Helius DAS API — indexes all Token-2022 mints, query by authority. Free tier covers it. **Tier 3:** Helius webhook listener → populates DB in real-time. | Tier 1: 1 hour. Tier 2: 2 hours. Tier 3: 4 hours. |
| **Public devnet RPC** | Free, no account needed | Helius Developer ($49/mo) or QuickNode Build ($49/mo) — swap one env var | 15 min |
| **No backend server** | All tx built client-side via wallet adapter | Add Next.js API routes or separate Express/FastAPI service for server-side operations (distributions, batch ops, webhook listeners) | Varies by feature |
| **Simulated KYC** (freeze/thaw = "KYC approval") | No real identity verification for demo | Integrate Civic Pass, Synaps, or Persona for real KYC. Transfer Hook validates on-chain KYC credential. | 1-2 weeks |
| **No persistent audit log** | Transaction history read from Solana RPC on each page load | Helius webhook → append events to Postgres `audit_log` table. Query locally instead of hitting RPC. | 4-8 hours |
| **`getTokenLargestAccounts` for cap table** | Public devnet RPC blocks `getProgramAccounts` for Token-2022 (`excluded from account secondary indexes`). `getTokenLargestAccounts(mint)` works on all RPCs but returns max 20 holders. | **Option A:** Switch to `getProgramAccounts` with paid RPC (Helius/QuickNode) — returns all holders, no cap. Code is a drop-in replacement (see `account-service.ts` inline comment). **Option B:** Helius DAS API `getTokenAccounts` — paginated, indexed, no holder cap. Best for 100+ holders. | Option A: 15 min (swap one function). Option B: 2 hours. |
| **Pinata IPFS for token images** | Free 1GB tier, browser-side uploads, no backend | **Production permanence:** Migrate to Irys (Arweave) — user pays ~$0.001 in SOL for truly permanent storage. Or keep Pinata with paid tier ($20/mo for 25GB). | 2-4 hours |
| **Lightweight transaction history** | `getParsedTransactions` batch call triggers 429 on public devnet RPC. Using `getSignaturesForAddress` only (single call) — shows signatures + timestamps, links to Explorer for details. | **With paid RPC:** Uncomment `getParsedTransactions` in `history-service.ts` for full parsed tx data (types, amounts, addresses). **Best:** Helius Enhanced Transactions API or webhook → DB for instant, pre-parsed history. | 30 min (paid RPC) or 4 hours (webhook). |

### Deployment Independence

The app MUST be deployable with:
```bash
cd cipherion-tokenize
npm install
npm run build
npm start
```

No dependencies on the parent repository. No shared node_modules. No monorepo tooling required.

---

## 17. File Tree Specification

```
cipherion-tokenize/
├── src/
│   ├── app/
│   │   ├── layout.tsx                      # Root layout: dark mode, fonts, providers
│   │   ├── page.tsx                        # Landing page
│   │   ├── globals.css                     # Full theme + utilities
│   │   ├── create/
│   │   │   └── page.tsx                    # Token creation wizard
│   │   ├── tokens/
│   │   │   ├── page.tsx                    # My tokens list
│   │   │   └── [mint]/
│   │   │       └── page.tsx                # Token dashboard (tabbed)
│   │   ├── portfolio/
│   │   │   └── page.tsx                    # Investor portfolio + transfer
│   │   └── explorer/
│   │       └── page.tsx                    # Public token lookup
│   │
│   ├── components/
│   │   ├── ui/                             # shadcn primitives (copied, not imported)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── table.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── tooltip.tsx
│   │   │   ├── popover.tsx
│   │   │   ├── separator.tsx
│   │   │   └── toast.tsx                   # Toast notification component
│   │   ├── wallet/
│   │   │   ├── wallet-provider.tsx         # Solana providers wrapper
│   │   │   └── connect-button.tsx          # Styled wallet connect
│   │   ├── token/
│   │   │   ├── create-wizard.tsx           # Multi-step creation form
│   │   │   ├── wizard-steps/
│   │   │   │   ├── basic-info-step.tsx
│   │   │   │   ├── compliance-step.tsx
│   │   │   │   ├── supply-step.tsx
│   │   │   │   ├── metadata-step.tsx
│   │   │   │   └── review-step.tsx
│   │   │   ├── token-card.tsx              # Token summary card
│   │   │   ├── token-stats.tsx             # Supply/holder stats row
│   │   │   └── metadata-editor.tsx         # Key-value metadata form
│   │   ├── holders/
│   │   │   ├── cap-table.tsx               # Holder table
│   │   │   ├── onboard-form.tsx            # Single + batch investor onboard
│   │   │   └── holder-row.tsx              # Individual holder row with actions
│   │   ├── transfer/
│   │   │   ├── transfer-form.tsx           # Token transfer UI
│   │   │   └── fee-preview.tsx             # Transfer fee breakdown
│   │   ├── compliance/
│   │   │   ├── compliance-panel.tsx        # Freeze/thaw/pause controls
│   │   │   ├── force-burn-dialog.tsx       # Permanent delegate burn dialog
│   │   │   └── status-badge.tsx            # Reusable KYC/freeze status indicator
│   │   ├── history/
│   │   │   ├── transaction-list.tsx        # Paginated tx history
│   │   │   └── export-button.tsx           # CSV export
│   │   ├── explorer/
│   │   │   └── token-lookup.tsx            # Public token search + display
│   │   └── shared/
│   │       ├── address-display.tsx         # Truncated address with copy
│   │       ├── explorer-link.tsx           # Link to Solana Explorer
│   │       ├── network-badge.tsx           # Devnet/Mainnet indicator
│   │       ├── loading-skeleton.tsx        # Shimmer loading states
│   │       ├── empty-state.tsx             # Empty list/table state
│   │       ├── error-state.tsx             # Error with retry button
│   │       └── sol-balance.tsx             # SOL balance display
│   │
│   ├── hooks/
│   │   ├── use-token-create.ts             # Token creation mutation
│   │   ├── use-token-info.ts               # Single token data query
│   │   ├── use-token-list.ts               # My tokens query
│   │   ├── use-holders.ts                  # Cap table query
│   │   ├── use-portfolio.ts                # Investor holdings query
│   │   ├── use-transfer.ts                 # Transfer mutation
│   │   ├── use-compliance.ts               # Compliance action mutations
│   │   ├── use-history.ts                  # Transaction history query
│   │   ├── use-network.ts                  # Network info + explorer URLs
│   │   ├── use-airdrop.ts                  # Devnet SOL airdrop
│   │   └── use-toast.ts                    # Toast notification hook
│   │
│   ├── lib/
│   │   ├── solana/
│   │   │   ├── connection.ts               # RPC connection factory
│   │   │   ├── token-service.ts            # Token-2022 CRUD operations
│   │   │   ├── account-service.ts          # ATA management, balance queries
│   │   │   ├── compliance-service.ts       # Freeze/thaw/pause/delegate ops
│   │   │   ├── metadata-service.ts         # On-chain metadata read/write
│   │   │   ├── history-service.ts          # Transaction history parsing
│   │   │   ├── constants.ts                # Program IDs, network URLs
│   │   │   └── types.ts                    # Shared Solana types
│   │   └── utils/
│   │       ├── format.ts                   # Address truncation, number formatting
│   │       ├── validation.ts               # Pubkey validation, amount parsing
│   │       └── csv.ts                      # CSV generation utility
│   │
│   ├── config/
│   │   └── asset-templates.ts              # Pre-built RWA asset type configs
│   │
│   └── types/
│       └── token.ts                        # App-level token types
│
├── programs/                               # Phase 1B: Anchor programs
│   └── transfer-hook/
│       ├── src/lib.rs
│       ├── Cargo.toml
│       └── Anchor.toml
│
├── public/
│   └── (static assets)
│
├── .env.local.example
├── .gitignore
├── next.config.ts
├── package.json
├── tsconfig.json
├── postcss.config.mjs
├── components.json                         # shadcn config
└── README.md
```

---

## 18. Dependency Manifest

```json
{
  "dependencies": {
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",

    "@solana/web3.js": "^1.95.0",
    "@solana/spl-token": "^0.4.0",
    "@solana/wallet-adapter-base": "^0.9.23",
    "@solana/wallet-adapter-react": "^0.15.35",
    "@solana/wallet-adapter-react-ui": "^0.9.35",
    "@solana/wallet-adapter-wallets": "^0.19.32",

    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-popover": "^1.1.0",
    "@radix-ui/react-select": "^2.1.0",
    "@radix-ui/react-separator": "^1.1.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-tooltip": "^1.1.0",

    "lucide-react": "^0.556.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "tw-animate-css": "^1.4.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^16.0.0"
  }
}
```

---

## 19. Error Handling Contract

Every layer of the application follows this contract:

### Service Layer (`lib/solana/`)

```typescript
// All service functions throw typed errors, never return undefined/null silently
class TokenServiceError extends Error {
  constructor(
    message: string,
    public readonly code: 'INSUFFICIENT_SOL' | 'WALLET_REJECTED' | 'NETWORK_ERROR' |
      'ACCOUNT_FROZEN' | 'TOKEN_PAUSED' | 'UNAUTHORIZED' | 'INVALID_INPUT' |
      'ACCOUNT_NOT_FOUND' | 'ALREADY_EXISTS' | 'RPC_ERROR',
    public readonly details?: unknown
  ) {
    super(message);
  }
}

// Example: never this
async function getTokenInfo(mint: PublicKey) {
  try {
    return await getMint(connection, mint, undefined, TOKEN_2022_PROGRAM_ID);
  } catch {
    return null; // BAD — silent failure
  }
}

// Always this
async function getTokenInfo(mint: PublicKey) {
  try {
    return await getMint(connection, mint, undefined, TOKEN_2022_PROGRAM_ID);
  } catch (err) {
    throw new TokenServiceError(
      `Failed to fetch token info for ${mint.toBase58()}`,
      'RPC_ERROR',
      err
    );
  }
}
```

### Hook Layer (`hooks/`)

```typescript
// Hooks expose: data, isLoading, error, refetch
// Components decide how to render each state
function useTokenInfo(mint: PublicKey | null) {
  const [data, setData] = useState<TokenInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<TokenServiceError | null>(null);
  // ...
  return { data, isLoading, error, refetch };
}
```

### Component Layer

```tsx
// Every async-data-dependent component handles all states
function TokenDashboard({ mint }: { mint: string }) {
  const { data, isLoading, error, refetch } = useTokenInfo(mint);

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return <EmptyState message="Token not found" />;

  return <TokenDashboardContent token={data} />;
}

// NEVER render a component that assumes data exists without these guards
```

### Transaction Feedback

Every blockchain transaction shows one of:
1. **Pending:** "Confirming transaction..." with spinner and tx signature link
2. **Success:** "Token created successfully" with mint address and Explorer link
3. **Failure:** Specific error message — not "Something went wrong" but "Insufficient SOL balance. You need 0.007 SOL, you have 0.002 SOL."

---

## 20. Testing Strategy

### Unit Tests (Vitest)

| Target | What to Test |
|--------|-------------|
| `lib/utils/format.ts` | Address truncation, number formatting edge cases |
| `lib/utils/validation.ts` | Pubkey validation (valid, invalid, empty, whitespace) |
| `lib/utils/csv.ts` | CSV generation with special characters, empty data |
| `config/asset-templates.ts` | All templates have required fields |
| Component rendering | Each component renders without crash in loading/empty/error states |

### Integration Tests (solana-test-validator)

| Target | What to Test |
|--------|-------------|
| `token-service.ts` | Create mint with each extension combination |
| `account-service.ts` | Create ATA, get holders, check frozen state |
| `compliance-service.ts` | Freeze, thaw, pause, unpause, force burn |
| `history-service.ts` | Parse transaction history correctly |
| End-to-end flows | Create token → mint → onboard → transfer → freeze |

### Manual Tests (Human Required)

| Scenario | Steps |
|----------|-------|
| Full demo script | 3-wallet scenario from Proposal Section 9 |
| Wallet error handling | Reject transaction in wallet, verify UI recovers |
| Network switch | Change wallet to wrong network, verify error |
| Mobile layout | Check all pages on phone/tablet |

### NOT Testing (MVP Scope)

- Performance benchmarks
- Load testing
- E2E browser automation (Playwright/Cypress) — manual testing sufficient for demo
- Visual regression testing
