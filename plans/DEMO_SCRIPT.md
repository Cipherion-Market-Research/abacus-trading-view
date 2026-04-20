# CipheX Atlas — Comprehensive Demo & Meeting Guide

**Duration:** 30–45 minutes (full), 20 minutes (abridged)
**Prerequisites:** Phantom wallet with ~2 SOL on devnet, Chrome/Brave
**URL:** Vercel deployment or `localhost:3000`

---

## Table of Contents

1. [Pre-Demo Reset](#1-pre-demo-reset)
2. [Public Marketing Shell](#2-public-marketing-shell)
3. [Institutional Onboarding (KYC)](#3-institutional-onboarding-kyc)
4. [Token Creation — The Full Story](#4-token-creation--the-full-story)
5. [Live Data Layer (Yield + NAV)](#5-live-data-layer-yield--nav)
6. [Issuer Flows: Management & Distribution](#6-issuer-flows-management--distribution)
7. [Holder Flows: Portfolio & Transfer](#7-holder-flows-portfolio--transfer)
8. [Compliance Enforcement](#8-compliance-enforcement)
9. [Redemption & Exit Paths](#9-redemption--exit-paths)
10. [Secondary Markets & DEX Limitations](#10-secondary-markets--dex-limitations)
11. [Audit Trail & Export](#11-audit-trail--export)
12. [Cost Economics](#12-cost-economics)
13. [What's Not Shipped Yet (Honest Framing)](#13-whats-not-shipped-yet)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Pre-Demo Reset

**To start fresh every time:**

1. Connect wallet → click green "KYC · Approved" pill → "Reset demo? yes"
2. This clears: KYC state, token list, distribution records, AND the Upstash catalog
3. You land on `/` as a brand-new visitor
4. On-chain tokens remain on devnet (immutable) — but they're invisible in the UI

**Alternatively**, if demoing for the first time on a clean browser, nothing to reset.

---

## 2. Public Marketing Shell

### Landing Page (`/`)

**Key claims to walk through:**

| Element | What it says | What it means |
|---|---|---|
| Hero badge | "Live on Solana · EVM chains coming" | Solana is production-ready today; Base + Polygon via ERC-3643 in next phase |
| MetaStat: `<$0.01` | Per-transfer cost across supported chains | Solana ~$0.003, Base ~$0.001, Polygon ~$0.01 |
| MetaStat: `2` standards | Token-2022 + ERC-3643 | Protocol-native compliance on Solana; audited ERC standard on EVM |
| MetaStat: `5` frameworks | SEC · MiCA · MAS · VARA · FINMA | Every extension maps to a regulatory requirement — shown in detail on `/regulation` |
| MetaStat: `3` chains | Solana live, EVM coming | Not a promise — architectural validation is done, implementation is next |
| IssuerCell grid | BlackRock $2.8B / 6 chains | Cross-chain totals, not Atlas AUM — these are market reference points |
| Proof point | "$500K+ traditional vs. Atlas" | Transfer-agent + registrar fees for a 10,000-investor fund |

### Institutions Page (`/institutions`)

**Key sections:**
- **Differentiators**: compliance enforced by protocol, institutional custody (Fireblocks/Squads/Safe), wallet-visible protections, secondary-market readiness
- **Cost-at-scale table**: show the 4 tiers (10 → 100 → 1K → 10K investors)
- **Custody callout**: "Single-key deployments exist but aren't recommended for production"

### Regulation Page (`/regulation`)

**Two tables to walk through:**

1. **Frameworks table** — 5 jurisdictions, what each regulator requires:
   - SEC (US): transfer restrictions, holder registry, forced transfer on court order
   - ESMA (EU/MiCA): governance controls, smart-contract enforceability
   - MAS (Singapore): holder registry, transfer eligibility, on-chain compliance
   - VARA (Dubai): freeze on regulator order, forced seize, sanctions screening
   - FINMA (Switzerland): registered tokenized securities, compliance infra, custody segregation

2. **Extension → Requirement mapping** — which Token-2022 primitive satisfies which rule:
   - `DefaultAccountState=Frozen` → KYC gating → Reg D/S/A+, MiCA, MAS
   - `Freeze/Thaw authority` → Account holds → Court orders, regulatory holds
   - `PermanentDelegate` → Forced transfer/burn → Sanctions, estate settlement, VARA
   - `Pausable` → Emergency halt → Regulatory emergency, NAV recalculation
   - `TransferHook` → Programmable compliance → Jurisdiction checks, investor caps
   - `MetadataPointer` → On-chain registry → ISIN, custodian, jurisdiction

**Key talking point:** "Extensions are immutable after creation. Investors get certainty that the rules won't change under them. This is BY DESIGN — not a limitation."

### FAQ Page (`/faq`)

Split by persona (Issuers, Investors, Compliance, Technical). Key questions to highlight per audience:
- **For compliance**: "Can the issuer seize tokens?" → only with PermanentDelegate, wallets warn holders
- **For investors**: "How do I sell?" → four paths (OTC, redemption, ATS, compliant AMM)
- **For technical**: "Why Solana?" → cost, native compliance, institutional adoption

---

## 3. Institutional Onboarding (KYC)

### What the flow looks like

1. Click "Get started" → `/signup`
2. **Step 1: Account info** — full name, email, organization, jurisdiction (US/EU/SG/AE/CH), role
3. **Step 2: Documentation** (optional) — drag-and-drop file upload area
4. **Step 3: Wallet bind** — connect Phantom/Solflare → 4-second mock approval → redirect

### What this maps to in production

| MVP (today) | Production |
|---|---|
| localStorage status flag | Server-side session + DB-backed approval state |
| 4-second auto-approve | Real KYC provider: Civic Pass, Synaps, or Persona |
| No document verification | Liveness check + ID verification + accreditation check |
| No expiry | KYC credential with TTL (e.g., 12 months), auto-freeze on expiry |

### KYC requirements by regulation

| Framework | What must be verified | Atlas enforcement mechanism |
|---|---|---|
| Reg D (US) | Accredited investor status | Issuer thaws account only after manual verification |
| Reg S (US) | Non-US person | Jurisdiction metadata + issuer-side whitelist |
| Reg A+ (US) | Qualified purchaser, investment limits | Issuer controls onboarding + Transfer Hook caps (Phase 2) |
| MiCA (EU) | Identity verification for all holders | KYC provider issues on-chain credential |
| MAS (Singapore) | AI/II status + identity | Same — KYC credential checked at thaw |
| VARA (Dubai) | Full identity + sanctions screening | KYC + sanctions oracle (Phase 2) |

**Key point:** "Today the issuer manually thaws = approves. In production, a KYC provider (Civic Pass) issues an on-chain credential and the Transfer Hook validates it automatically on every transfer."

---

## 4. Token Creation — The Full Story

### The 5-Step Wizard (`/create`)

**Step 1: Basic Info**
- Name, symbol (2-10 chars, uppercase), decimals (0-9), asset type
- Asset type selection auto-fills metadata templates (treasury, real estate, equity, commodity, debt, fund)
- Optional: image upload (drag-and-drop → Pinata IPFS, or manual URL)

**Step 2: Compliance Configuration**

| Extension | What it does | Immutable? | Who should enable |
|---|---|---|---|
| **KYC Gating** (DefaultAccountState=Frozen) | All new token accounts start frozen; issuer must thaw to approve | Yes | Everyone doing regulated securities |
| **Transfer Fees** (TransferFeeConfig) | Automatic basis-point fee on every transfer | Yes (rate immutable) | Revenue-generating tokens, platform fees |
| **Pausable** | Emergency halt all activity | Yes (capability) | Tokens with NAV recalculation periods, fund tokens |
| **Permanent Delegate** | Authority can burn/transfer from any account | Yes | Tokens requiring forced redemption, sanctions, court orders |

**What they need to understand:** These are set ONCE at creation and CANNOT be changed. This is the entire point — investors need to trust that the rules are permanent. If you didn't enable PermanentDelegate at creation, you can never force-burn tokens later.

**Step 3: Supply & Authorities**
- Initial supply (can be 0 — mint later)
- No hard cap — mint authority can always create more
- Authorities (mint, freeze, update) assigned to creator's wallet
- **Authority wallet security callout:** "Use Squads multisig or Fireblocks for production. A lost single-key means permanently inaccessible authorities."

**Step 4: Metadata (on-chain)**

This is where asset-specific information lives. Each field is a key-value pair stored directly on-chain in the token account:

| Key | Example value | Purpose |
|---|---|---|
| `jurisdiction` | US | Where the asset is regulated |
| `regulatory_framework` | Reg D | Which rules apply |
| `asset_type` | treasury | Visual categorization |
| `nav_per_token` | 10.00 | Net asset value for redemption pricing |
| `coupon_rate` | 5.25 | Annual yield % (drives the live ticker) |
| `maturity_date` | 2026-12-31 | When the asset matures |
| `custodian` | State Street | Who holds the underlying |
| `isin` | US912797... | International securities identification |
| `fund_manager` | Cipherion Capital | Operating entity |
| `image` | ipfs://Qm... | Token avatar in wallets and UI |

**Key point:** "Metadata is mutable — the update authority can change NAV, add new fields, update custodian info. But the compliance EXTENSIONS are permanent."

**Step 5: Review & Confirm**
- Cost estimate shown: typically ~$0.63 in rent deposit (refundable if token is ever closed)
- One wallet approval creates the entire token on-chain
- Success: mint address, Explorer link, redirect to dashboard

### After creation — what can change vs. what can't

| Mutable | Immutable |
|---|---|
| Supply (mint more, burn) | Extensions (KYC gating, fees, pausable, delegate) |
| Metadata fields (NAV, custodian, maturity) | Fee rate (bps) and max fee |
| Authority assignment (transfer to multisig) | Whether PermanentDelegate exists |
| Authority revocation (permanent) | Program ID the token lives under |

---

## 5. Live Data Layer (Yield + NAV)

### Yield Ticker

Appears at the top of any token detail page when metadata has `coupon_rate`, `annual_yield`, `yield`, or `apy`.

- **Computation:** `supply × rate / (365 × 86400)` per second
- **Display:** live counter showing "accrued today" resetting at 00:00 UTC
- **After a distribution:** shows "Last paid 2h ago · 500 tokens to 12 holders"
- **What it replicates:** Franklin Templeton BENJI's 2025 differentiator — institutions consistently call this a "lean forward" moment

**Honest framing:** "The ticker is a visualization. It doesn't trigger on-chain actions. The actual payout happens when the issuer runs a distribution."

### NAV Oracle Display

Appears below the yield ticker when metadata has `nav_per_token`.

- Shows: NAV per token ($10.00), total AUM (supply × NAV), attestation badge
- **Today:** "Issuer-attested" — the issuer manually sets `nav_per_token` in metadata
- **Production:** Chainlink or Pyth oracle feed updating NAV automatically, with on-chain timestamp

---

## 6. Issuer Flows: Management & Distribution

### Token Dashboard (`/tokens/[mint]`)

Tabs: Holders | Mint | Distributions | Token Details | Compliance | History

### Onboarding investors (Holders tab)

1. Enter investor's Solana wallet address
2. Atlas creates their token account (ATA) and thaws it (= KYC approval)
3. They appear in the cap table as "Active"
4. **Batch mode:** paste multiple addresses, one per line

**What this means:** The investor now has an approved slot for this token. They can receive transfers, participate in distributions, and show up in the cap table. Without this step, any transfer TO them fails at the protocol level.

### Minting (Mint tab)

- Enter amount, optionally specify a destination wallet
- Default: mints to issuer's own ATA (treasury)
- If token has DefaultAccountState=Frozen, Atlas auto-thaws before minting

### Distribution flows (Distributions tab)

Two modes:

| Mode | Allocation math | Eligibility | Use case |
|---|---|---|---|
| **Pro-rata** | `(holderBalance / circulatingSupply) × totalAmount` | Non-frozen, non-treasury, balance > 0 | Ongoing yield, coupons, dividends |
| **Equal share** | `totalAmount / eligibleCount` | Non-frozen, non-treasury (any balance) | Initial allocations, airdrops |

**Flow:**
1. Pick mode, enter total amount + memo (e.g., "Q1-26 5.25% coupon")
2. Preview shows per-holder allocation
3. Click "Run" → sequential mint per recipient (one wallet sign each)
4. Progress UI shows per-recipient status
5. If wallet rejects mid-run: completed recipients keep theirs, remaining are skipped

**Exclusions:** Treasury (issuer) address and frozen accounts are always excluded from allocation math.

**Cost per recipient:** ~$0.003 (one on-chain mint instruction)

**What this replicates:** BlackRock BUIDL's mint-to-holder mechanic. Not transfer-from-treasury — actual new token creation into each wallet.

---

## 7. Holder Flows: Portfolio & Transfer

### Portfolio page (`/portfolio`)

Shows all Token-2022 tokens in the connected wallet with:
- Name, symbol, balance, frozen/active status
- Asset-type icon (if metadata has `asset_type`)
- Click to select → Transfer panel and Redeem button appear

### Transfers

- Enter recipient address + amount
- **Transfer fee preview:** if TransferFeeConfig is enabled, shows "Recipient will receive X (fee: Y bps)"
- Validation: recipient must have an approved (thawed) token account
- If recipient is frozen: "Recipient account is frozen. The issuer must approve this account first."
- If sender is frozen: "Your account is frozen for this token. Contact the issuer."
- If token is paused: "Token is currently paused by the issuer."

### What holders CANNOT do today (future work)

| Action | Status | Target |
|---|---|---|
| Self-custody (hold in any Solana wallet) | Works today | — |
| P2P transfer to approved wallets | Works today | — |
| View yield accrual | Works today | — |
| Receive distributions | Works today | — |
| Redeem at NAV (demo) | Works today (simulator) | Production: atomic burn+USDC |
| Request redemption (queue) | Not shipped | Phase 2 |
| Trade on regulated ATS | Not shipped | Requires ATS integration |
| Trade on compliant DEX pool | Not shipped | Requires Transfer Hook |
| Delegate/stake tokens | Not applicable | RWA tokens aren't staking instruments |

---

## 8. Compliance Enforcement

### Compliance tab on token dashboard

**Token-level controls:**
- **Pause** (if Pausable enabled): halts ALL transfers, minting, burning globally
- **Resume**: lifts the pause
- Use cases: NAV recalculation period, regulatory emergency, corporate action

**Account-level controls:**
- **Freeze**: blocks a specific holder from sending or receiving
- **Thaw**: re-enables their account
- Use cases: suspicious activity, KYC expiry, regulatory hold, court order

**Permanent Delegate actions:**
- **Force burn**: destroy tokens from any holder's account without their consent
- Requires typing the token symbol to confirm (type-to-confirm safety)
- Use cases: sanctions compliance, court-ordered seizure, forced redemption at maturity, estate settlement

### How enforcement works at the protocol level

This is NOT application-level logic. The Solana runtime itself rejects invalid operations:

```
Transfer to frozen account → Runtime error 0x11 (Custom:17) "Account is frozen"
Transfer from frozen account → Same error
Transfer when paused → Runtime error "Token is paused"
Transfer to unapproved wallet → No ATA exists, transfer physically impossible
```

A user cannot bypass these checks by using a different client, calling the RPC directly, or building their own transaction. The TOKEN PROGRAM enforces it — not Atlas.

### What compliance CAN'T do (honest limitations)

- Cannot prevent someone from transferring SOL or other non-Atlas tokens
- Cannot freeze the wallet itself (only the token account within it)
- Cannot enforce geographic restrictions without a Transfer Hook (Phase 2)
- Cannot enforce investor caps (max holders, max balance) without a Transfer Hook
- Cannot audit transactions in real-time without a webhook listener (production upgrade)

---

## 9. Redemption & Exit Paths

### Atomic Redemption Simulator (today)

On `/portfolio` → select token → "Redeem at NAV":
1. Enter amount to redeem
2. Atlas reads `nav_per_token` from on-chain metadata
3. Shows: "Burn 100 CTN-26 → Receive $1,000.00 USDC"
4. On confirm: executes burn via Permanent Delegate authority
5. Success: downloadable JSON receipt with burn signature

**Honest framing:** "The USDC settlement is simulated in this demo. In production, this is an atomic transaction bundle: burn token + transfer USDC in a single instruction set — either both succeed or neither does."

### All exit paths (full picture)

| Path | Status | How it works | Timeline |
|---|---|---|---|
| **Private OTC transfer** | Available now | Holder finds a buyer (must be onboarded), transfers directly | — |
| **Issuer redemption** | Simulator shipped | Burn at NAV + stablecoin payout. Production needs: USDC treasury, atomic bundler | Phase 2 |
| **Regulated ATS** | Not shipped | Securitize Markets, tZERO, INX.one, Archax | Requires integration per venue |
| **Compliant DEX pool** | Not shipped | Raydium/Orca pool with Transfer Hook validating both sides | Requires Transfer Hook (Phase 2) |

---

## 10. Secondary Markets & DEX Limitations

### Why tokens CAN'T trade on Jupiter/Raydium/pump.fun

1. Token uses `DefaultAccountState=Frozen`
2. A DEX pool needs a token account to hold the token
3. That account starts frozen — DEX can't create an approved account
4. Only the issuer can thaw = approve accounts
5. **Protocol-level enforcement, not application logic**

### What Transfer Hook enables (Phase 2)

- Issuer deploys a custom Anchor program
- Every transfer passes through the hook
- Hook checks: is sender on whitelist? Is recipient on whitelist?
- Issuer can whitelist specific DEX pool accounts → compliant on-chain trading
- Non-whitelisted venues physically cannot process swaps

### Compliant AMM flow (future)

1. Issuer creates token with Transfer Hook pointing to whitelist program
2. Issuer approves a Raydium pool account on the whitelist
3. Only pre-approved investors can swap in that pool
4. Every swap is validated by the hook — no unapproved party can participate
5. Issuer can revoke the pool at any time (remove from whitelist)

### What to tell counterparties who ask about liquidity

"Atlas handles issuance, compliance, and distribution — one box in the stack. Secondary trading requires a regulated venue partner. We integrate with whichever ATS or compliant pool the issuer chooses. We don't promise liquidity — we promise compliant infrastructure that liquidity venues can plug into."

---

## 11. Audit Trail & Export

### History tab

- Shows all on-chain operations for a token: Mint, Transfer, Freeze, Thaw, Burn, Pause
- Each entry: timestamp, type, from/to addresses, amount, Explorer link
- Signature links open Solana Explorer for independent verification

### CSV Export

One-click download with columns:
- Timestamp, Type, From Address, To Address, Amount, Fee, Memo, Tx Signature, Block

### What production audit looks like

| MVP (today) | Production |
|---|---|
| Read from RPC on each page load | Helius webhook → Postgres `audit_log` table |
| Max ~100 recent transactions | Unlimited history, pre-parsed |
| Manual CSV export | Automated SOC-2 report generation |
| No real-time alerts | Slack/PagerDuty on suspicious activity |

---

## 12. Cost Economics

### Per-action costs (Solana, at current SOL price ~$89)

| Action | Cost | Notes |
|---|---|---|
| Create token (full compliance) | ~$0.63 | Rent deposit, refundable if closed |
| Custom Transfer Hook deploy | $45–$134 | One-time program deployment |
| Onboard investor | ~$0.19 | Create ATA + thaw |
| Transfer | ~$0.003 | Single instruction |
| Distribution (per recipient) | ~$0.003 | One mint instruction per holder |
| Freeze/thaw/pause | ~$0.003 | Single instruction |
| Force burn | ~$0.003 | Single instruction |

### Year-1 total at scale

| Scale | On-chain | RPC infra | Total |
|---|---|---|---|
| 10 investors (demo) | ~$3 | Free | ~$3 |
| 100 investors (pilot) | ~$110 | $49/mo | ~$700 |
| 1,000 investors | ~$450 | $49/mo | ~$1,035 |
| 10,000 investors | ~$2,440 | $499/mo | ~$8,430 |

**Comparison:** Traditional transfer agent + registrar for 10,000 investors: **$500,000+/year**

### What the issuer pays vs. the investor

- **Issuer pays:** account creation, minting, compliance actions, distributions
- **Investor pays:** only the ~$0.003 transfer fee when they move tokens
- **Transfer fees (if enabled):** deducted from recipient's received amount, not sender's balance

### Cost variability

- Denominated in SOL — fluctuates with SOL price
- Base fee (5,000 lamports) is protocol-defined, doesn't change with congestion
- Priority fees add $0.001–$0.005 during busy periods
- If SOL doubles → transfers cost $0.006 (still negligible)

---

## 13. What's Not Shipped Yet (Honest Framing)

### For the meeting — what to say

"This is a fully functional demo on Solana devnet. The token program is the same on mainnet — one env-var swap. Here's what's between this demo and a production deployment:"

| Gap | What it means | Effort | Blocks |
|---|---|---|---|
| **Real KYC provider** | Current KYC is a 4-second mock | 1–2 weeks | Taking real users |
| **Server-side KYC state** | Currently localStorage (bypassable) | 1 week | Taking real users |
| **Mainnet deployment** | Config change + custody plan + legal | 2–3 days + legal time | Real money |
| **Transfer Hook program** | Enables compliant DEX, jurisdiction checks | 2–4 weeks (Rust/Anchor) | Compliant secondary trading |
| **Helius webhook → DB** | Real-time audit persistence | 4–8 hours | SOC-2 compliance |
| **Multi-chain (Base/Polygon)** | ERC-3643 integration | 6–10 weeks | Serving EVM-native issuers |

### What IS production-ready today

- Token-2022 program (same on devnet and mainnet — $2B+ secured in production)
- All compliance extensions (freeze, thaw, pause, permanent delegate)
- Wallet compatibility (Phantom, Solflare, Backpack, Ledger, Fireblocks)
- Creation wizard, distribution engine, cap table, compliance panel
- Explorer catalog with public access
- Cost model (validated at scale)

---

## 14. Troubleshooting

| Issue | Fix |
|---|---|
| "Insufficient SOL" | Request SOL at faucet.solana.com (link in header) |
| 429 rate limiting | Set `NEXT_PUBLIC_RPC_ENDPOINT` to Helius (see `.env.local.example`) |
| Explorer empty after seed | Check Upstash env vars are set (`KV_REST_API_URL` + `KV_REST_API_TOKEN`) |
| KYC pill not visible | You're on a public page — navigate to `/tokens` first |
| Wallet won't connect | Ensure Phantom is set to Devnet (Settings → Developer Settings → Solana → Devnet) |
| "Token not found" on explorer detail | Mint address may be from a prior session — token exists on-chain but catalog was flushed |
| Redemption button disabled | Token must have `nav_per_token` in metadata AND Permanent Delegate enabled |
| Seeder says "already seeded" | Tokens exist in catalog from a prior run — reset first, or proceed to use them |
| Transfer fails with "Account is frozen" | Recipient hasn't been onboarded (thawed) by the issuer |
| Build fails locally | `rm -rf .next && npm run dev` — Turbopack cache corruption |

---

## Quick Reference: Demo Click Path (Abridged 20-min version)

1. **Reset** → KYC pill → "yes"
2. **Onboard** → "Get started" → fill form → connect wallet → auto-approve
3. **Seed** → `/explorer` → "Seed 5 demo tokens" → approve 5 times
4. **Explore** → click CTN-26 → show yield ticker + NAV + metadata
5. **Manage** → `/tokens` → CTN-26 dashboard → onboard a holder → mint supply
6. **Distribute** → Distributions tab → pro-rata → 500 tokens → run
7. **Compliance** → freeze a holder → show rejection → thaw
8. **Redeem** → `/portfolio` → select token → "Redeem at NAV" → burn → download receipt
9. **Audit** → History tab → show tx list → export CSV
10. **Wrap** → cost slide, roadmap, "questions?"
