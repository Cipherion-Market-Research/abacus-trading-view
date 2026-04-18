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
| 🟨 P2 | Cap table mobile card view | `/tokens/[mint]` Holders tab currently uses horizontal-scroll table. Card-per-holder would read better on phones. | 30 min |
| 🟨 P2 | Portfolio `TokenRow` mobile balance alignment | Right-aligned balance column can crowd the status badge on iPhone SE (375px). | 15 min |
| 🟨 P2 | Create wizard mobile polish | Step indicator + 5-step form. Works but could use more breathing room on phones. | 30 min |
| 🟨 P2 | `/tokens/[mint]` Compliance tab mobile verify | Forms within weren't explicitly audited for mobile. | 15 min |
| 🟨 P2 | `/tokens/[mint]` History tab mobile verify | Transaction list uses `<Table>` primitive (has horizontal scroll) but could benefit from stacked rows on mobile. | 30 min |
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

If I had to pick three things to ship next, in order:

1. **🟥 Server-side KYC state** (move off localStorage → session + DB). Blocks taking any real user.
2. **🟧 Real KYC provider integration** (Civic Pass or Synaps). Blocks any regulated issuer actually using Atlas.
3. **🟧 Transfer Hook program** (Phase 1B Rust/Anchor work). Unlocks compliant DEX listings + mint-level memo enforcement, and is the single biggest product differentiator still unshipped.

Everything else in this document is either polish (🟨) or depends on these three being done.
