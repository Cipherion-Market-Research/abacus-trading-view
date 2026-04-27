# CipheX Atlas — Roadmap

**Last updated:** 2026-04-23 (post-Phase 2.B + remediation sprint)
**Purpose:** Ordered roadmap from current demo state → pilot-ready → public-production. For current build state see `ATLAS_HANDOFF.md`. For the ordered execution checklist see `PRE_PRODUCTION_CHECKLIST.md`.

---

## Legend

- ✅ **Shipped** — in `main`, verified on devnet
- 🟥 **P0** — blocker; cannot proceed without this
- 🟧 **P1** — required for pilot/production; schedule into current phase
- 🟨 **P2** — polish, differentiator; schedule opportunistically
- 🟩 **P3** — future/speculative; don't start without a customer pulling
- ⚪️ **Ops** — infrastructure/configuration, not product code
- 💼 **Biz** — business/legal/partnership work, parallel to code

---

## Phase map

| Phase | Goal | Duration | Exit criteria |
|---|---|---|---|
| **1 — Foundation** | Production-grade demo: full issuer + investor lifecycle on Solana | ✅ Shipped 2026-04-21 | Phases 1A–1G + Tracks A/B complete |
| **2 — Pilot-Ready** | Institutional posture, multisig governance, quality hardening, chain narrative | ~2 weeks | Platform passes institutional diligence bar; demo script complete |
| **3 — Market Launch** | Production infrastructure: real KYC, institutional custody, mainnet issuance | ~6–8 weeks | First paying issuer onboards and issues tokens on mainnet |
| **4 — Platform Scale** | Full institutional feature set: compliance depth, EVM expansion, secondary liquidity | ~3–5 months post-launch | Competitive parity with Securitize in the $50–300M AUM segment |

All Phase 2 work is prerequisite to Phase 3. Phase 3 work can begin before Phase 2 finishes, but the first paying issuer cannot land before all Phase 3 items ship.

---

## 1. ✅ Phase 1 — Shipped work

### 1A — Dashboard MVP
Wallet connection, Token-2022 creation wizard (5 asset templates, all compliance extensions), cap table, onboarding, pro-rata + equal distributions, P2P transfer, freeze/thaw/pause/force-burn, transaction history, explorer lookup. Devnet-verified end-to-end.

### 1B — Environment hardening + Vercel deploy
Pinata server proxy (`/api/ipfs/upload`), Helius origin-lock, Upstash catalog (`/api/mints/register` with on-chain authority verification), live on Vercel.

### 1C — Marketing + KYC gate
Landing, `/institutions`, `/regulation`, `/faq`, 3-step mock-KYC signup, `<RequireKyc>` client guard, `KycPill` reset flow, faucet deep-link.

### 1D — Design system parity
AtlasLogo/Wordmark, Polaris Crosshair favicon, `PageHeader`, unified canvas color, all-Geist typography scale, wordmark attribution.

### 1E — Mobile + tablet responsive
Marketing nav drawer, app header drawer, responsive type, table stacking, tabs overflow scroll, meta stats grid, iOS input-zoom prevention.

### 1F — Demo polish
`YieldTicker` (per-second accrual), `TokenAvatar` (asset-type icons), sample-data seeder (5 realistic tokens), **Distributions tab** (mint-to-holder pro-rata + equal-share, BUIDL mechanic).

### 1G — Demo refinements
`/tokens` migrated to Upstash KV, atomic redemption simulator (burn at NAV + JSON receipt), `NavDisplay`, distribution accrual record on yield ticker, seeder idempotency, full demo reset.

### Track A — Demo polish + holder view (2026-04-21)
Compliance pre-trade simulator (5-rule engine), audit pack ZIP export, reconciliation panel (CSV diff + inline onboard), holder detail `/portfolio/[mint]`, landing page overhaul.

### Track B — NAV mutation + scoped history + EVM table + cleanup (2026-04-21)
On-chain NAV update form (`updateMetadataFields` + auto-sets `nav_date`), scoped transaction history on `/portfolio/[mint]` (wallet ATA query), ERC-3643 compliance mapping table on `/regulation`, `pillars-test` dev scratch removed, `sample-register.csv` fixture.

---

## 2. Phase 2 — Pilot-Ready (next 2 weeks)

**Goal:** achieve institutional-grade posture ahead of first pilot engagements. The platform is functionally complete — this phase delivers multisig governance, compliance controls, the chain expansion narrative, and the quality baseline that sophisticated counterparties examine during diligence.

### 2.1 Institutional posture

| Priority | Item | Notes | Est. |
|---|---|---|---|
| 🟧 P1 | **Squads multisig integration — authorities step** | Add "Use Squads multisig" option to creation wizard Step 3 (Supply & Authorities). Paste a Squads vault address as mint/freeze/permanent-delegate authority. Dashboard shows authority is a multisig and deep-links to the Squads vault. No deep integration — just recognition and display. | 2–3 days |
| 🟧 P1 | **Jurisdiction enforcement in simulator** | Compliance simulator currently reads 5 rules. Add rule 6: jurisdiction mismatch. Metadata field `allowed_jurisdictions` (comma-separated). Compare against investor's KYC-declared jurisdiction (from localStorage form data for now). Verdict line: "BLOCKED — investor jurisdiction AU not in allowed set [US, EU]". | 3–4 hours |
| 🟨 P2 | **Authority rotation UI** | Transfer mint/freeze authority to another pubkey (or Squads vault). Supported on-chain; no UI today. Useful for "migrate to multisig" demo beat. | 4 hours |

### 2.2 ✅ Audit-trail durability — SHIPPED

Distributions and reconciliation register persisted to Upstash. Wallet-signed auth on all write routes. SETNX dedup with canonical hashing. Pending-sync banner on failed server writes. Remediation sprint added auth to `/api/mints/register`, fixed pause-state and defaultAccountState detection, sanitized error responses, added Zod validation to GET params.

| Priority | Item | Notes | Est. |
|---|---|---|---|
| 🟨 P2 | **Compliance action audit log** | Every freeze/thaw/pause/burn/authority-rotation POSTs a row to a server log keyed by mint + actor + timestamp + tx signature. On-chain tx is canonical; log is for UI + regulator export. | 1 day |

### 2.3 Multichain narrative (no EVM code yet)

| Priority | Item | Notes | Est. |
|---|---|---|---|
| 🟧 P1 | **Chain Advisor flow** | 5-question interactive tool: jurisdiction, asset class, distribution venue, custody relationship, ATS target. Outputs a reasoned chain recommendation (Solana / Base / Polygon / Avalanche). Lives at `/chains/advisor` and is embedded in the workspace onboarding flow. Entirely client-side — no chain code. | 2 days |
| 🟧 P1 | **Chain abstraction refactor** | Wrap `lib/solana/*.ts` behind a `TokenService` interface. Re-structure as `lib/chains/solana/*`. Every hook and component calls the interface, not `@solana/web3.js` directly. Non-user-visible. Unblocks Phase 4 Base integration. | 3–5 days |
| 🟨 P2 | **ChainBadge + ChainSelector shared components** | Ship the components even though only Solana is wired up. Displayed consistently on `/portfolio` rows, `/explorer` catalog, `/tokens/[mint]` header. | 1 day |
| 🟨 P2 | **DualStandardTable** on `/regulation` | Token-2022 extension ↔ ERC-3643 module side-by-side (builds on the table already shipped in Track B). | 4 hours |
| 🟨 P2 | **`/chains` public page** | Chain comparison deep-dive. Cost table, compliance-standard mapping, supported-wallet matrix per chain. | 1 day |
| 🟨 P2 | **ChainCostTable** replacing Solana-only `/institutions` cost table | Columns: Solana, Base (projected), Polygon (projected), Avalanche (projected). Labels projected rows clearly. | 4 hours |

### 2.4 Quality baseline

| Priority | Item | Notes | Est. |
|---|---|---|---|
| 🟧 P1 | **Test suite baseline — pure functions** | Vitest. Unit tests on `reconcile.ts` (6 diff states × edge cases), `audit-pack.ts` (ZIP contents + CSV escaping), compliance-simulator rules engine, `distribution-service.ts` `computeAllocations`. Target: 100% branch coverage on these four. | 2 days |
| 🟧 P1 | **Playwright smoke suite** | 5 journeys: create token → seed → distribute → simulate block → export audit pack. Runs against devnet. CI-gated. | 1.5 days |
| 🟨 P2 | **Console.log cleanup** | 21 occurrences across 9 files. Replace debug logs with a `debug()` helper that noops in production, keep intentional error logs. | 2 hours |
| 🟨 P2 | **Multi-viewport manual QA pass** | iPhone SE 375, iPhone 14 393, iPad Mini 768, iPad Pro 1024, desktop. Landscape on phones. | 45 min |

### 2.5 Documentation

| Priority | Item | Notes | Est. |
|---|---|---|---|
| 🟧 P1 | **`DEMO_SCRIPT.md` full refresh** | Current script predates Track A. Add sections: compliance simulator beat, audit pack export beat, reconciliation walkthrough, issuer→holder wallet switch on `/portfolio/[mint]`, NAV mutation demo. | 2 hours |
| 🟨 P2 | **`DESIGN_SYSTEM.md`** | Consolidate AtlasLogo/Wordmark, PageHeader, MarketingNav/Footer, MetaStat, Pillar, Row, CostCard, RequireKyc, KycPill, ChainBadge. | 2 hours |

---

## 3. Phase 3 — Market Launch (6–8 weeks)

**Goal:** convert from a compelling demo to a live, revenue-generating platform. A paying issuer can complete real KYC, issue tokens on mainnet, manage their cap table, and distribute to verified investors. See `PRE_PRODUCTION_CHECKLIST.md` for the ordered execution plan with acceptance criteria.

### 3.1 Backend foundation

| Priority | Item | Notes | Est. |
|---|---|---|---|
| 🟥 P0 | **Supabase backend provisioned** | Auth (email + wallet SIWS), Postgres, RLS, Vercel integration. Replaces localStorage for KYC state, distributions, reconciliation register, compliance log. | 2–3 weeks |
| 🟥 P0 | **Role model** | `admin`, `issuer`, `compliance_officer`, `investor`, `auditor_readonly`. RLS policies per role. Admin approves new issuer workspaces. | included above |
| 🟥 P0 | **Server-side route guards** | Every mutating API route verifies session + role. Every sensitive page verifies server-side, not just client `<RequireKyc>`. | 3 days |
| 🟥 P0 | **Append-only compliance audit log** | Postgres table: `compliance_events` (mint, actor, action, tx_sig, timestamp, metadata). Exposed to auditor-readonly role. Exported in audit pack. | 2 days |
| 🟥 P0 | **`/api/rpc` proxy** | Helius key becomes server-only (`HELIUS_RPC_ENDPOINT`). Browser calls `/api/rpc`, server forwards with auth. Rate-limited. | 1 day |
| 🟧 P1 | **Rate limiting on mutating routes** | Upstash Ratelimit on `/api/mints/register`, `/api/ipfs/upload`, `/api/distributions/*`, `/api/reconciliation/*`. | 4 hours |
| 🟧 P1 | **Monitoring + error reporting** | Sentry (or equivalent). Alert on API 5xx, Solana tx failures, KYC verification failures. | 2 hours |

### 3.2 Identity & compliance

| Priority | Item | Notes | Est. |
|---|---|---|---|
| 🟥 P0 | **Real KYC provider — Persona** | Replaces mock 3-step signup. Keep the wizard shape; swap step 2 for Persona Inquiry. Webhook → server flips user state to `kyc_approved`. | 1.5–2 weeks |
| 🟥 P0 | **Accredited-investor verification** | Separate flow from KYC. Persona Accreditation module or VerifyInvestor.com. Required for Reg D 506(c) offerings. Surfaced as a pill on investor profile. | 1 week |
| 🟧 P1 | **KYC portability / reusable attestation** | Investor KYC'd for issuer A can request transfer to issuer B without re-submitting docs. Server-side attestation with timestamp + expiry. | 3 days |

### 3.3 Custody & authority governance

| Priority | Item | Notes | Est. |
|---|---|---|---|
| 🟥 P0 | **Squads multisig required on mainnet** | Phase 2 shipped display + wizard option. Phase 3 makes multisig mandatory for any mint/freeze/permanent-delegate authority on mainnet. Enforced at `/api/mints/register` — rejects single-key authorities on mainnet. | 2 days |
| 🟧 P1 | **Fireblocks integration documented** | Institutional path. No build — just docs + a verified onboarding runbook. | 4 hours |

### 3.4 Mainnet deploy

| Priority | Item | Notes | Est. |
|---|---|---|---|
| 🟥 P0 | **Helius paid-tier + mainnet RPC** | Developer plan ($49/mo). Allowed-domains configured. | 15 min |
| 🟥 P0 | **Env var flip + fresh mints** | `NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta`. Code is chain-agnostic between devnet and mainnet (same Token-2022 program ID). | 2 days incl. QA |
| 🟥 P0 | **Custom domain + SSL** | `atlas.cipherion.com` or similar. | 15 min |
| 🟥 P0 | **Rotate leaked secrets** | Pinata JWT + Helius key were pasted into chat. Rotate before any production use. | 15 min |
| 🟥 P0 | **Marketing copy audit** | Walk back "Live on Solana · Base · Avalanche · Ethereum" to reflect actual state. Flag any other aspirational claims. | 2 hours |

---

## 4. Phase 4 — Platform Scale (post-mainnet, 3–5 months)

**Goal:** build the institutional platform that the $50–300M AUM segment actually needs — one that Securitize prices out of reach and legacy transfer agents cannot offer digitally. Sequencing is deliberate: Transfer Hook requires real KYC from Phase 3, EVM requires the chain abstraction from Phase 2.

### 4.1 Compliance depth

| Priority | Item | Notes | Est. |
|---|---|---|---|
| 🟧 P1 | **Transfer Hook program (Rust/Anchor)** | Whitelist-based compliance enforcement. Creation-wizard toggle. Integration into dashboard. Multisig governance of hook upgrade authority. | 6 weeks (program 2–4, integration + governance 2+) |
| 🟧 P1 | **Investor caps via Transfer Hook** | Max holder count + max balance per wallet. Builds on hook. | +1 week |
| 🟨 P2 | **Confidential Transfers (when re-enabled by Solana)** | Token-2022 ZK balance extension. Incompatible with Transfer Hooks — pick one. | 2 weeks when available |

### 4.2 Distributions & lifecycle

| Priority | Item | Notes | Est. |
|---|---|---|---|
| 🟧 P1 | **Waterfall distributions** | Preferred returns, hurdle rates, carried interest. Critical for PE / VC / real-estate funds (bigger segment than treasuries in the $50–300M band). | 1 week |
| 🟧 P1 | **Capital calls** | Reverse of distributions: issuer calls capital from committed investors. Workflow + deadline + status tracking. | 1 week |
| 🟧 P1 | **Production redemption queue** | Upgrade from current simulator. Approval queue before burn, NAV cutoff windows, real USDC payout. | 1–2 weeks |
| 🟨 P2 | **DRIP (dividend reinvestment)** | Auto-reinvest distributions into additional tokens. Builds on pro-rata. | 3–5 days |

### 4.3 Onboarding workflow

| Priority | Item | Notes | Est. |
|---|---|---|---|
| 🟧 P1 | **Subscription agreement + e-sign** | Upload offering memo → investor reads → e-signs subscription (DocuSign embedded or Dropbox Sign) → wire instructions → issuer confirms wire → tokens mint. | 1–2 weeks |
| 🟨 P2 | **Investor messaging** | "Send notice to all holders" with retained audit trail. Scheduled sends. Regulator-friendly comms log. | 1 week |

### 4.4 Tax reporting

| Priority | Item | Notes | Est. |
|---|---|---|---|
| 🟧 P1 | **1099-DIV / 1042-S / K-1 export surface** | CSV + PDF per investor. Scheduled generation at year-end. Feeds into audit pack. | 2 weeks |

### 4.5 Secondary market

| Priority | Item | Notes | Est. |
|---|---|---|---|
| 🟧 P1 | **OTC desk / RFQ** | Compliant peer-to-peer with pre-clearance. Request-for-quote between approved holders. | 2 weeks |
| 🟨 P2 | **ATS integrations** | Per-ATS: Securitize Markets, tZERO, INX.one, Archax. Each has its own API + KYC portability story. | 4–6 weeks per ATS |
| 🟨 P2 | **Compliant AMM pool on Raydium/Orca** | Transfer Hook validates both sides of swap. Depends on Phase 4.1 hook. | 2–3 weeks |

### 4.6 EVM chain expansion

Detailed research in `MULTICHAIN_RESEARCH_2026-04.md`. Recommended sequence: **Base → Polygon PoS → Avalanche C-Chain**. XRPL/Stellar deferred indefinitely until a named customer asks. Plume re-evaluated late 2026.

| Priority | Item | Notes | Est. |
|---|---|---|---|
| 🟩 P3 | **Base + ERC-3643 / T-REX** | Depends on Phase 2 chain abstraction + Phase 3 backend + KYC (ONCHAINID needs real identity). `wagmi` + `viem` + T-REX SDK + ONCHAINID per investor. | 6–10 weeks |
| 🟩 P3 | **Polygon PoS** | Same code path as Base. Biggest existing RWA market outside Ethereum. | 1–2 weeks after Base |
| 🟩 P3 | **Avalanche C-Chain** | Subnet upsell documented. Weaker current TVL than Polygon. | 1–2 weeks after Polygon |
| 🟩 P3 | **XRPL / Stellar** | Different programming model. Defer until issuer asks. | Re-evaluate annually |

### 4.7 Ecosystem integrations

| Priority | Item | Notes | Est. |
|---|---|---|---|
| 🟨 P2 | **Fund-admin integration** | SS&C, NAV Consulting, Aquila, Kriya. Each has a different SFTP/API. Unlock for the $50–300M band where outsourced admin is the norm. | 2 weeks per admin |
| 🟨 P2 | **Issuer API** | RESTful + webhook. Cap table, distributions, compliance events. Depends on backend. | 2 weeks |
| 🟨 P2 | **White-label** | Custom domain + branding per issuer workspace. | 1 week |

---

## 5. 💼 Business & Legal Track (parallel to Phase 3)

**Not product work, but gated to public production. Start in parallel with Phase 3 code.**

| Item | Lead time | Notes |
|---|---|---|
| Broker-dealer partner signed | 4–12 weeks | North Capital / Dalmore / Entoro. Cannot legally run securities issuance in the US without one (or registering yourself, which is 24+ months). |
| Legal opinion on tokenization structure | 4–8 weeks | Outside counsel with tokenization experience. Required by institutional counterparties in diligence. |
| Insurance carrier engagement | 6–10 weeks | E&O and cyber policies. Insurer will ask about multisig, custody, incident response. |
| Fractional compliance officer or hire | 2–6 weeks | Required for SEC-registered offerings. Responsible for the compliance controls. |
| ATS partnership (pick 1 to start) | 8–16 weeks | Securitize Markets, INX.one, tZERO, or SDX depending on jurisdiction. |
| First pilot issuer signed | ongoing | Ideally a $50–200M AUM fund manager willing to run the first mainnet issuance. |

---

## 6. ⚪️ Ops & Infrastructure (ongoing)

| Priority | Item | Notes |
|---|---|---|
| ⚪️ Ops | Upstash KV provisioned | Done via Vercel Marketplace. `KV_REST_API_URL` / `KV_REST_API_TOKEN` auto-populated. |
| ⚪️ Ops | Supabase provisioned (Phase 3) | Vercel Marketplace → Supabase. Env vars auto-populated. |
| ⚪️ Ops | Helius allowed-domains | Production domain + `*.vercel.app` for previews. Empty for local dev. |
| ⚪️ Ops | Custom domain + SSL | Phase 3. |
| ⚪️ Ops | Rotate pasted secrets | Phase 3 blocker. |
| ⚪️ Ops | Sentry monitoring | Phase 3. |
| ⚪️ Ops | Status page | Post-mainnet. `status.atlas.cipherion.com`. |

---

## 7. Technical debt & known test gaps

- No E2E verification of freeze/thaw of a specific holder mid-flow — unit tests only.
- No E2E verification of force-burn via PermanentDelegate against a real holder.
- Pause/unpause effect on in-flight transfers — untested.
- Transfer-fee accrual to collector account — visible in receipt, accrual untested.
- Large-holder cap table (>20 holders) — blocked by `getTokenLargestAccounts` 20-holder cap.
- Wallet rotation (mint authority transfer) — supported by Solana, no UI yet (tracked in Phase 2.1).
- Transaction history uses `getSignaturesForAddress` only (lightweight mode) — full parse via Helius Enhanced Transactions or Webhook → DB needed for production.

Phase 2.4 test baseline covers the pure-function core. E2E gaps above move into Phase 3 Playwright expansion.

---

## 8. Decision points requiring user input

Before Phase 3 starts, lock in:

1. **Backend platform:** Supabase (recommended — auth + Postgres + RLS + Vercel one-click) vs Neon+custom auth vs AWS Cognito+RDS.
2. **KYC vendor:** Persona (recommended — best mid-market pricing, US/EU coverage, accreditation module), Synaps (crypto-native), or Civic (third).
3. **Broker-dealer partner:** North Capital, Dalmore, Entoro, or register in-house. Start outreach now.
4. **Custody default:** Fireblocks (institutional) vs Squads (prosumer) as the "recommended" path in our onboarding.
5. **EVM standard lock-in:** ERC-3643 (recommended — $32B issued, open standard) vs ERC-1400 (legacy) vs ERC-7518/DyCIST (emerging).
6. **First pilot issuer profile:** asset class, jurisdiction, AUM. Drives Phase 4 prioritization (waterfall vs treasury-only).

---

## 9. Next-session priorities

**Phase 2.B (audit-trail durability) is shipped.** All write routes authenticated, extension detection fixed, error responses sanitized. Ready for production testing.

**Remaining Phase 2 items, in priority order:**

1. 🟧 **Production test pass** — run the full demo flow on devnet, verify all shipped features including Phase 2.B server persistence, compliance simulator with pause-state, defaultAccountState detection, mints/register auth.
2. 🟧 **Pure-function test baseline (Vitest)** — `reconcile.ts`, `audit-pack.ts`, compliance-simulator rules, `computeAllocations`. Highest-leverage quality gate.
3. 🟧 **Squads multisig option in creation wizard** — institutional posture for pitch meetings.
4. 🟧 **Chain Advisor flow (`/chains/advisor`)** — biggest narrative unlock for pilot meetings.
5. 🟧 **Chain abstraction refactor** — unblocks Phase 4 Base work.
6. 🟧 **`DEMO_SCRIPT.md` refresh** — current script predates Phase 2.B wallet-auth flows.
7. 🟨 Console.log cleanup (21 occurrences → `debug()` helper).

**Starting Phase 3?** Read `PRE_PRODUCTION_CHECKLIST.md` first.

**Business track?** Start broker-dealer outreach and KYC-vendor demos in parallel — both have 4–12 week lead times.
