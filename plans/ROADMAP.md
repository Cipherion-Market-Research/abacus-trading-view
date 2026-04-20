# CipheX Atlas — Roadmap

**Last updated:** 2026-04-18
**Purpose:** Consolidated list of remaining work, categorized by priority. For current build state see `ATLAS_HANDOFF.md`. For original scope see `RWA_TOKEN_PLATFORM_IMPLEMENTATION_PLAN.md`.

---

## Legend

- 🟥 **P0** — blockers for production mainnet launch
- 🟧 **P1** — high value before production, can wait for Phase 2
- 🟨 **P2** — polish, nice-to-have
- 🟩 **P3** — long-term / future / speculative
- ⚪️ **Ops** — infrastructure + configuration, not code

---

## 1. Dashboard polish (carryover from Phase 1E mobile pass)

| Priority | Item | Notes | Est. |
|---|---|---|---|
| ✅ Done | Cap table mobile card view | `<Table>` rendered on `sm:block`, card-per-holder stack on mobile (address + status pill on row 1, balance + % on row 2). | shipped 2026-04-18 |
| ✅ Done | Portfolio `TokenRow` mobile balance alignment | Title row uses `flex-wrap` so status badge drops below name+symbol when crowded. Right column gets `shrink-0`. | shipped 2026-04-18 |
| ✅ Done | Create wizard mobile polish | Step indicator gets `overflow-x-auto scrollbar-hide` so 5 pills can swipe on tiny phones. Wizard card padding `p-4 sm:p-6`. Page padding `px-5 md:px-6 py-6 md:py-8`. | shipped 2026-04-18 |
| ✅ Done | `/tokens/[mint]` Compliance tab mobile | Holder rows stack action buttons below info on mobile via `flex-col sm:flex-row`. Status pill wraps with balance via `flex-wrap`. | shipped 2026-04-18 |
| ✅ Done | `/tokens/[mint]` History tab mobile | Transaction rows stack signature + memo above time + link via `flex-col sm:flex-row` with `justify-between` only on `sm+`. | shipped 2026-04-18 |
| 🟨 P2 | Multi-viewport manual QA pass | iPhone SE (375), iPhone 14 (393), iPad Mini (768), iPad Pro (1024), desktop. Human judgment required. | 45 min |
| 🟨 P2 | Landscape orientation check | `md:` rules apply at 768px regardless of orientation. Phones in landscape at 750×393 may behave unexpectedly. | 15 min |

---

## 2. Compliance features (Phase 1B)

| Priority | Item | Notes | Est. |
|---|---|---|---|
| 🟧 P1 | **Transfer Hook program** | Anchor/Rust program enforcing whitelist-based transfer compliance. Unlocks compliant DEX trading, jurisdiction checks, investor caps. The canonical path for mint-level memo enforcement (dropped from the account-level MemoTransfer approach in Phase 1A). | 2–4 weeks |
| 🟧 P1 | Whitelist registry UI | Frontend for adding/removing whitelisted addresses, visualizing hook state. Depends on above. | 3–5 days |
| 🟧 P1 | Transfer Hook wizard toggle | Creation-wizard step exposing the hook. Requires program deployed first. | 1 day |
| 🟨 P2 | Investor caps (hook logic) | Max-holder-count and max-balance-per-wallet enforcement. Adds ~1 week of hook work. | +1 week |

---

## 3. Production readiness (Phase 2)

| Priority | Item | Notes | Est. |
|---|---|---|---|
| 🟥 P0 | **Real KYC provider integration** | Wire `/signup` step 2 to Civic Pass, Synaps, or Persona. Keep the 3-step shape; swap mock file-upload for real doc verification + liveness. | 1–2 weeks |
| 🟥 P0 | **Server-side KYC state** | Current implementation uses `localStorage` (anyone can flip status client-side). Move to session-based auth with DB-backed approval state before charging anyone money. | 1 week |
| 🟥 P0 | **Mainnet deployment** | One env-var swap (`NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta` + paid-tier RPC). Requires legal review, authority-wallet custody setup (Squads/Fireblocks), and fresh mints on mainnet (no migration from devnet). | 2–3 days + legal time |
| 🟧 P1 | Helius key behind `/api/rpc` proxy | Current setup relies on Helius origin-lock for browser-side key exposure. Zero-exposure path is a server-side proxy with a server-only `HELIUS_RPC_ENDPOINT` var. Mirrors the Pinata proxy pattern. | 1 day |
| 🟧 P1 | Persistent audit log | Transactions currently read from Solana RPC on each page load. Helius webhook → append events to Postgres `audit_log` table. Query locally; eliminates RPC load for history views. | 4–8 hours |
| 🟧 P1 | Cap table — full pagination | Currently uses `getTokenLargestAccounts` (max 20 holders). Switch to `getProgramAccounts` with Helius DAS or webhook-populated DB for unbounded holder count. | 2 hours |
| 🟧 P1 | Transaction history — full parse | Currently uses `getSignaturesForAddress` only (rate-limit accommodation). Helius Enhanced Transactions API or webhook → DB gives full parsed data. | 4 hours |

---

## 3b. Demo polish (Phase 1F) — shipped 2026-04-18

Research-driven feature set to make a counterparty walkthrough land. Pivoted from "transfer pro-rata from treasury" to "mint-to-holder pro-rata" after research surfaced that BUIDL/BENJI/OUSG all use mint-based distributions.

| Item | Status | Notes |
|---|---|---|
| ✅ Yield ticker | shipped | `YieldTicker` component reads `coupon_rate` / `annual_yield` / `apy` from metadata. Live per-second accrual computation, displayed at top of `/tokens/[mint]` and `/explorer/[mint]`. Replicates Franklin BENJI's 2025 differentiator. |
| ✅ Asset-type icons | shipped | `TokenAvatar` component — uses Pinata image if present, falls back to lucide icon + tinted bg per asset type. Threaded through Explorer catalog, `/tokens` cards, and `/portfolio` rows. `usePortfolio` extended to read `image` and `asset_type` from metadata. |
| ✅ Sample data seeder | shipped | `SeedDemoButton` on `/explorer` empty state, dialog walks through 5 realistic tokens (Treasury, REIT, private credit, gold, tech index). Real on-chain creation, auto-registered in catalog, ~$0.04 SOL total cost. Eligibility: devnet + connected + KYC approved. |
| ✅ Distributions tab | shipped | New tab on `/tokens/[mint]`. **Mint-to-holder pro-rata** (BUIDL mechanic). Form: total amount + memo + allocation preview. Sequential signing with per-recipient progress UI. Per-mint history persisted to localStorage. Excludes treasury, frozen, and zero-balance accounts from pro-rata. |

## 3c. Phase 1G — Continued demo refinements (shipped 2026-04-20)

Picked up where Phase 1F left off. Same demo-first lens — building features that wow institutional buyers in a 30-min walkthrough without requiring real production infrastructure.

| Item | Status | Notes |
|---|---|---|
| ✅ Migrate `/tokens` → Upstash KV | shipped | `useTokenList` now fetches from `/api/mints/list?creator=<wallet>` as primary source, localStorage as fallback. Cross-environment inconsistency resolved. |
| ✅ Atomic redemption simulator | shipped | "Redeem at NAV" button on `/portfolio`. Dialog: amount → NAV calc → Permanent Delegate burn → mock USDC receipt → downloadable JSON receipt. |
| ✅ NAV oracle display | shipped | `NavDisplay` component on `/tokens/[mint]` and `/explorer/[mint]`. Reads `nav_per_token` from metadata, shows per-token NAV + total AUM + issuer-attested badge. |
| ✅ Distribution accrual record | shipped | Yield ticker now shows "Last paid Xh ago · Y tokens to Z holders" when distribution history exists for the mint. |
| ✅ Sample-data seeder idempotency | shipped | Seeder checks catalog for existing entries by name+creator before minting. Skips duplicates. |
| ✅ Demo reset (full) | shipped | KYC pill "Reset demo" now clears localStorage + flushes Upstash catalog via `POST /api/mints/flush`. Clean slate for meeting walkthroughs. |
| 🟨 P2 | Compliance pre-trade simulator | Paste a wallet → green/red with the specific rule that fired. | 1.5 h |
| 🟨 P2 | Regulator-ready blotter export | One-click "Audit pack" download: holder list + tx blotter + metadata snapshot. | 1 h |
| 🟨 P2 | Reconciliation view | Side-by-side on-chain holders vs "official register" snapshot. | 2 h |

---

## 4. Revenue features (Phase 2)

| Priority | Item | Notes | Est. |
|---|---|---|---|
| 🟧 P1 | **Programmable distributions** | Pro-rata yield/coupon/dividend payments to all approved holders. #1 most-requested RWA feature. Token-2022 PermanentDelegate supports it; needs: batch flow UI, NAV calculation helper, per-holder distribution history. | 2–3 weeks |
| 🟧 P1 | Waterfall distributions | Preferred returns, hurdle rates, carried interest. Builds on pro-rata. | +1 week |
| 🟧 P1 | Redemption workflows | Investor-initiated request → issuer approval queue → NAV-based burn + USDC payout. Critical for fund-administrator use case. | 1–2 weeks |
| 🟨 P2 | DRIP (dividend reinvestment) | Auto-reinvest distributions into additional tokens. Builds on pro-rata. | 3–5 days |
| 🟨 P2 | NAV oracle | On-chain NAV updates for fund tokens. Enables automated subscription/redemption pricing. | 1 week |

---

## 5. Secondary market (Phase 2+)

| Priority | Item | Notes | Est. |
|---|---|---|---|
| 🟧 P1 | **OTC desk / RFQ** | Compliant peer-to-peer transfer with pre-clearance. Request-for-quote system between approved holders. Feasible on top of current stack. | 2 weeks |
| 🟨 P2 | ATS integration | Integration with Securitize Markets, tZERO, or Archax for regulated listing. Each ATS has its own API + KYC portability requirements. | 4–6 weeks per ATS |
| 🟨 P2 | Compliant AMM pool | Permissioned liquidity pool on Raydium/Orca. Transfer Hook validates that both sides of every swap are approved. Depends on Phase 1B hook. | 2–3 weeks |
| 🟩 P3 | Lending/borrowing | RWA tokens as collateral. Liquidation logic (auction to pre-approved liquidators) is the hard part. | 4+ weeks |

---

## 5b. Multi-chain expansion (Phase 3)

Detailed research in `plans/MULTICHAIN_RESEARCH_2026-04.md`. Strategic premise (every named institutional issuer is multi-chain) is correct, but **explicitly gated behind the Phase 2 P0 blockers**: real KYC provider, server-side KYC state, mainnet deploy. Don't widen scope until we can serve real users on the chain we already have.

| Priority | Item | Notes | Est. |
|---|---|---|---|
| 🟩 P3 | **Add Base + ERC-3643 / T-REX** | Lowest-cost EVM chain, strongest US distribution story via Coinbase. Requires `wagmi`/`viem` wallet adapter, T-REX SDK integration, ONCHAINID per investor (real KYC dependency), chain-aware service layer. **Realistic estimate: 6–10 weeks for one EVM chain done right** — not the "ships fastest" framing in the research doc. | 6–10 weeks |
| 🟩 P3 | Add Polygon PoS | Same code path as Base. Biggest existing RWA market outside Ethereum (BUIDL, Franklin BENJI). | 1–2 weeks (after Base) |
| 🟩 P3 | Add Avalanche C-Chain | Subnet upsell motion documented. Smaller current TVL than Polygon but stronger institutional positioning. | 1–2 weeks (after Polygon) |
| 🟩 P3 | Evaluate XRPL / Stellar | Different programming models, higher engineering lift. Defer until specific issuer asks. | Re-evaluate annually |
| 🟩 P3 | Re-evaluate Plume | Could subsume Atlas's compliance-wizard layer. Needs a strategic call before committing. | Re-evaluate late 2026 |

**Marketing claim discipline:** do NOT claim multi-chain on the landing until at least one EVM chain ships end-to-end. Current "Built on Solana Token-2022" framing is honest and stays.

---

## 6. Confidentiality & advanced features (Phase 3)

| Priority | Item | Notes | Est. |
|---|---|---|---|
| 🟩 P3 | Confidential Transfers | Token-2022 extension — ElGamal-encrypted balances with ZK proofs. Currently paused by Solana for security audit; re-enable expected. Incompatible with Transfer Hooks, so pick one. | 2 weeks (when available) |
| 🟩 P3 | Fund-of-funds / basket tokens | Tokenized index products. Deep infrastructure: NAV calculation, rebalancing, compliance inheritance. | 6+ weeks |
| 🟩 P3 | Cross-chain bridge support | Bridge RWA tokens to EVM chains for broader composability. Major compliance risk — only compliant bridges (LayerZero + whitelist). | 4+ weeks |

---

## 7. Operations & infrastructure

| Priority | Item | Notes | Est. |
|---|---|---|---|
| ⚪️ Ops | Helius allowed-domains (production) | Restrict the Helius RPC key to your prod domain + `*.vercel.app` for previews. Leave empty for local dev (Helius rejects `localhost`). | 5 min |
| ⚪️ Ops | Upstash KV provisioned on Vercel | Provisioned via Marketplace → Upstash. `KV_REST_API_URL` / `KV_REST_API_TOKEN` auto-populated. | done if live |
| ⚪️ Ops | Custom domain + SSL | Point `tokenize.cipherion.com` (or similar) at Vercel. | 15 min |
| ⚪️ Ops | Rotate secrets | Pinata JWT and Helius key were pasted into Claude conversation history at various points during the build. Rotate both before public launch. | 15 min |
| ⚪️ Ops | Monitoring / alerting | No APM or error reporting configured. Add Sentry or similar before real users. | 2 hours |
| ⚪️ Ops | Rate limiting on API routes | `/api/mints/register` is currently unauthenticated. A malicious actor could spam registrations (the on-chain verification prevents spoofed creators, but not garbage mint-attempts). Add Upstash Ratelimit or similar. | 2 hours |

---

## 8. Documentation / housekeeping

| Priority | Item | Notes | Est. |
|---|---|---|---|
| 🟨 P2 | Design system reference doc | Consolidate the accumulated primitives (AtlasLogo/Wordmark, PageHeader, MarketingNav/Footer, MetaStat, Pillar, Row, CostCard, RequireKyc, KycPill) into `plans/DESIGN_SYSTEM.md`. Would make onboarding new agents faster. | 2 hours |
| 🟨 P2 | CLAUDE.md / AGENTS.md refresh | `cipherion-tokenize/CLAUDE.md` and `AGENTS.md` reference old Next.js behavior and are pre-build. Refresh to point at current patterns + common pitfalls. | 1 hour |
| 🟨 P2 | Demo scenario walkthrough | Scripted 3-wallet demo (Issuer, Investor A, Investor B) from the original proposal doc (Section 9). Useful for counterparty presentations. Could live as a `plans/DEMO_SCRIPT.md`. | 2 hours |
| 🟩 P3 | API docs for `/api/mints/*` | If we open the catalog to external issuers (white-label / third-party tokenizers), the register/list endpoints need public docs + auth. | 4 hours |

---

## 9. Known test gaps

These aren't tasks per se — they're things that work but weren't explicitly verified end-to-end in the current build.

- Compliance actions on a held account — freeze/thaw of a specific holder mid-flow. Unit tests pass, E2E incomplete.
- Force-burn via Permanent Delegate on a real holder's balance. Unit tests pass, E2E incomplete.
- Pause/unpause effect on in-flight transfers.
- Transfer with fee config — fee accrual to collector account. Visible in receipt, not verified accrual.
- Wallet rotation (mint authority transfer). Supported in Solana but no UI currently.
- Large-holder cap table (>20 holders) — current limit of `getTokenLargestAccounts` means untested beyond demo scale.

---

## Priorities for the next session

**Demo polish track** (P2 remaining from 1G):

1. **🟨 Compliance pre-trade simulator** (1.5h) — paste a wallet address on the Compliance tab, get green/red with the specific rule that fired. T-REX-style enforceability demo without the actual hook.
2. **🟨 Regulator-ready blotter export** (1h) — one-click "Audit pack" download: holder list + tx blotter + metadata snapshot as a ZIP.
3. **🟨 Reconciliation view** (2h) — side-by-side on-chain holders vs "official register" snapshot. Counterparty's #1 stated pain point.

**Multichain track** (Phase B — when Base integration begins):

4. **ChainBadge + ChainSelector** shared components
5. **DualStandardTable** for regulation page (Token-2022 vs ERC-3643 mapping)
6. **ChainCostTable** replacing Solana-only cost table on `/institutions`
7. New `/chains` route with chain comparison deep-dive

**Production-readiness track** (Phase 2 P0 blockers):

8. **🟥 Server-side KYC state** — move off localStorage. Blocks taking any real user.
9. **🟥 Real KYC provider integration** (Civic Pass / Synaps / Persona). Blocks any regulated issuer.
10. **🟥 Mainnet deploy** — needs custody plan (Squads / Fireblocks) + legal review.
11. **🟧 Transfer Hook program** (Rust/Anchor) — unlocks compliant DEX listings; biggest unshipped product differentiator.

All three tracks are independent. Pick one direction at the start of the next session.
