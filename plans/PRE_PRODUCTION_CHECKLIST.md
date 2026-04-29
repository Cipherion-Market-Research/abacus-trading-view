# CipheX Atlas — Pre-Production Checklist

**Purpose:** Ordered execution plan from current state (Phase 1 shipped) to public production (first paying issuer live on mainnet). Each item has scope, acceptance criteria, and dependencies.

**Companion to:** `ROADMAP.md` (the what), `ATLAS_HANDOFF.md` (current state).

**Two phases here:**
- **Phase 2 — Demo Completion** (2 weeks) closes the gaps that make a $50–300M AUM counterparty say "you're not serious yet" in the first meeting.
- **Phase 3 — Pre-Production** (6–8 weeks) is everything required before an issuer can legally, safely, and operationally onboard on mainnet.

Phase 4 (differentiation, EVM, secondary market) sits post-production and is scoped in `ROADMAP.md` §4.

---

## Phase 2 — Demo Completion

**Exit criteria:** a live prospect can run the demo end-to-end, see a plausible institutional posture (multisig, multichain story, jurisdiction enforcement, durable audit trail), and we have a test baseline + clean codebase.

### 2.A Institutional posture

#### 2.A.1 Squads multisig option in creation wizard
- **Scope:** Step 3 of `/create` adds a "Use Squads multisig" section. Paste a Squads vault address; it becomes mint/freeze/permanent-delegate authority. `/tokens/[mint]` dashboard shows "Authority: Multisig (3-of-5)" badge with a deep-link to the Squads vault page. No deep Squads SDK integration.
- **Acceptance:**
  - [ ] Create wizard accepts a pasted Squads vault address and validates it is a valid Squads PDA (length + program derivation).
  - [ ] Token created with a Squads authority displays a distinct badge.
  - [ ] Compliance actions attempted by the connected wallet when authority is a Squads vault show a "This action requires multisig approval — proposal opened in Squads" explanation and a deep-link.
- **Est:** 2–3 days. **Dep:** none.

#### 2.A.2 Jurisdiction enforcement in simulator
- **Scope:** Add rule 6 to `compliance-simulator.tsx`. Metadata field `allowed_jurisdictions` (comma-separated ISO codes). Investor jurisdiction read from KYC form data in localStorage (Phase 3 will switch to server). New verdict: `BLOCKED — investor jurisdiction AU not in [US, EU]`.
- **Acceptance:**
  - [ ] Simulator rules array has 6 entries, jurisdiction rule is rendered whether or not metadata is present (shows "No jurisdiction restriction" when empty).
  - [ ] Creation-wizard metadata step exposes a multi-select for `allowed_jurisdictions`.
  - [ ] Unit test covers the 4 states: no restriction, matching, mismatching, missing investor jurisdiction.
- **Est:** 3–4 hours. **Dep:** 2.D.1 test baseline.

#### 2.A.3 Authority rotation UI
- **Scope:** New action on `/tokens/[mint]` → Compliance tab: "Transfer mint authority" and "Transfer freeze authority" to another pubkey (or Squads vault). On-chain supported today; currently no UI.
- **Acceptance:**
  - [ ] Rotation to Squads vault demonstrated end-to-end on devnet.
  - [ ] Prior authority cannot perform the action after rotation.
- **Est:** 4 hours. **Dep:** 2.A.1 (for multisig demo).

### 2.B Audit-trail durability

#### 2.B.1 Persist distributions server-side
- **Scope:** Move distribution history from `localStorage["ciphex-atlas-distributions-<mint>"]` to Upstash (Phase 2) or Supabase (Phase 3). Append-only writes. UI still reads from localStorage cache, but source of truth is server. New routes: `POST /api/distributions/record`, `GET /api/distributions/list?mint=<addr>`.
- **Acceptance:**
  - [ ] New distribution from `DistributionForm` POSTs to server; on-chain tx is confirmed before record is written.
  - [ ] Clearing browser localStorage does not erase distribution history visible in the UI.
  - [ ] Distribution CSV in audit pack matches server records, not localStorage.
  - [ ] Unit tests: recording, listing, idempotency on retry.
- **Est:** 1 day. **Dep:** none (Upstash already provisioned).

#### 2.B.2 Persist reconciliation register server-side
- **Scope:** Same pattern. `POST /api/reconciliation/register`, `GET /api/reconciliation/register?mint=<addr>`. Register is a versioned document — each upload creates a new version; diff results reference a specific version.
- **Acceptance:**
  - [ ] Uploaded register survives browser clear.
  - [ ] Diff output includes `register_version` + `captured_at`.
  - [ ] Export-diff CSV filename includes the register version.
- **Est:** 1 day. **Dep:** none.

#### 2.B.3 Compliance action log
- **Scope:** Every freeze/thaw/pause/unpause/force-burn/authority-rotation POSTs to `/api/compliance/log` with `{ mint, actor, action, tx_sig, timestamp, metadata }`. Exposed in audit pack.
- **Acceptance:**
  - [ ] All compliance mutations hit the logger (grep audit confirms).
  - [ ] Audit pack includes `compliance_log.csv`.
  - [ ] Log entries are append-only (no UPDATE/DELETE route).
- **Est:** 1 day. **Dep:** 2.B.1 server pattern established.

### 2.C Multichain narrative

#### 2.C.1 Chain Advisor flow (`/chains/advisor`)
- **Scope:** 5 questions → reasoned chain recommendation.
  1. Jurisdiction (US / EU / APAC / LATAM / Other)
  2. Asset class (Treasury / Real estate / Private credit / Equity / Commodity / Fund-of-funds)
  3. Distribution venue (Self-serve investors / ATS / Institutional direct)
  4. Custody preference (Fireblocks / Squads / Unsure)
  5. Secondary market expectation (Hold-to-maturity / Periodic redemption / Active trading)
- Output: recommended chain + 3-sentence rationale + named-issuer precedents. Embedded in workspace onboarding (Phase 3) and standalone marketing asset.
- **Acceptance:**
  - [ ] Publicly accessible at `/chains/advisor` (no KYC required).
  - [ ] Recommendation deterministic from inputs (unit test covers 5 canonical input combos).
  - [ ] Rationale cites real deployments (BUIDL, BENJI, Ondo, etc.) drawn from `MULTICHAIN_RESEARCH_2026-04.md`.
- **Est:** 2 days. **Dep:** none.

#### 2.C.2 Chain abstraction refactor
- **Scope:** Wrap `lib/solana/*.ts` behind a `TokenService` interface. New directory `lib/chains/solana/*` re-exported via `lib/chains/index.ts`. Hooks and components call `getTokenService(chainId).createToken(...)`, not `createMint(...)`. Token types parameterized by chain where needed (publickey vs hex address).
- **Acceptance:**
  - [ ] Zero direct imports of `@solana/web3.js` or `@solana/spl-token` outside `lib/chains/solana/`.
  - [ ] Build + type-check clean. All Phase 1 journeys still pass.
  - [ ] Interface documented with JSDoc at `lib/chains/token-service.ts`.
- **Est:** 3–5 days. **Dep:** 2.D.1 (tests must run before + after to prove no regression).

#### 2.C.3 ChainBadge + ChainSelector components
- **Scope:** Shared primitives. Only "Solana" wired up; other chain entries stubbed as "Coming soon." Badge on `/portfolio` rows, `/explorer` catalog, `/tokens/[mint]` header.
- **Acceptance:**
  - [ ] Badge renders with chain icon + short name.
  - [ ] Selector disabled for non-Solana with tooltip "Available in Q3 2026."
- **Est:** 1 day.

#### 2.C.4 `/chains` public page + DualStandardTable + ChainCostTable
- **Scope:** Chain comparison deep-dive (extends regulation page). Token-2022 ↔ ERC-3643 side-by-side, projected cost per chain, supported-wallet matrix.
- **Acceptance:**
  - [ ] Live at `/chains`.
  - [ ] ChainCostTable replaces the Solana-only cost table on `/institutions`, labels non-live chains as projected.
- **Est:** 1.5 days.

### 2.D Quality baseline

#### 2.D.1 Pure-function test suite
- **Scope:** Vitest config. Tests for:
  - `lib/utils/reconcile.ts` — 6 diff states × edge cases (empty inputs, address-case mismatch, balance precision, frozen/active mismatches).
  - `lib/utils/audit-pack.ts` — ZIP contents, CSV escaping, transaction cap behavior.
  - `components/compliance/compliance-simulator.tsx` — rules engine extracted to pure function, all 6 rules covered.
  - `lib/solana/distribution-service.ts` — `computeAllocations` for pro-rata and equal modes, precision handling.
- **Acceptance:**
  - [ ] `npm test` runs Vitest, passes clean.
  - [ ] Branch coverage ≥ 90% on the four modules above.
  - [ ] Added to CI (GitHub Actions or Vercel checks).
- **Est:** 2 days.

#### 2.D.2 Playwright smoke suite
- **Scope:** 5 user journeys on devnet:
  1. Signup → KYC approve → create token with seeder wallet.
  2. Onboard holder → distribute pro-rata → verify balances.
  3. Compliance simulator: run 3 canonical cases.
  4. Export audit pack → validate ZIP structure.
  5. Switch to holder wallet → view `/portfolio/[mint]` → redeem at NAV.
- **Acceptance:**
  - [ ] `npm run e2e` runs against local dev server + devnet.
  - [ ] Runs in CI on PR.
- **Est:** 1.5 days.

#### 2.D.3 Console.log cleanup + debug helper
- **Scope:** 21 occurrences across 9 files. Replace debug logs with `debug(scope, msg, data?)` helper. Noop in production. Keep intentional error logs.
- **Acceptance:**
  - [ ] Grep for `console.log` in `src/` returns zero.
  - [ ] `debug.ts` helper added; behaviour gated by `NEXT_PUBLIC_DEBUG` env var.
- **Est:** 2 hours.

#### 2.D.4 Multi-viewport QA pass
- iPhone SE 375, iPhone 14 393, iPad Mini 768, iPad Pro 1024, desktop, phone landscape. Manual. **Est:** 45 min.

### 2.E Documentation

#### 2.E.1 `DEMO_SCRIPT.md` refresh
- **Scope:** Add beats for: compliance simulator, audit pack export, reconciliation walkthrough, issuer→holder wallet switch, NAV mutation. Reflect Track A + B.
- **Est:** 2 hours.

#### 2.E.2 `DESIGN_SYSTEM.md`
- **Scope:** Consolidate primitives reference. AtlasLogo/Wordmark, PageHeader, MarketingNav/Footer, MetaStat, Pillar, Row, CostCard, RequireKyc, KycPill, ChainBadge.
- **Est:** 2 hours.

### Phase 2 total effort
~13–16 engineering-days across the buckets. Fits comfortably in 2 calendar weeks with one engineer, under 1 week with two engineers working independent tracks (Institutional posture + Audit trail are parallelizable with Multichain narrative and Quality baseline).

---

## Phase 3 — Pre-Production

**Exit criteria:** first paying issuer can complete real KYC, verify accreditation, create a mint on mainnet with a multisig authority, distribute to real investors, and have every compliance action recorded in a tamper-resistant log. Broker-dealer partnership signed (business track). Legal review complete.

### 3.A Backend foundation (Weeks 1–3)

#### 3.A.1 Supabase provisioning + schema
- **Scope:** Vercel Marketplace → Supabase integration. Auth providers: email (OTP), Solana SIWS wallet-signature. Initial schema:
  - `users` (id, email, wallet_address, created_at, kyc_status, accredited_status)
  - `workspaces` (id, issuer_name, created_by, chain_default, status)
  - `workspace_members` (workspace_id, user_id, role)
  - `mints` (mint_address, workspace_id, chain, status, created_at)
  - `distributions` (id, mint_address, memo, total_amount, mode, tx_sigs jsonb, created_by, created_at)
  - `reconciliation_registers` (id, mint_address, version, uploaded_at, uploaded_by, entries jsonb)
  - `compliance_events` (id, mint_address, actor, action, tx_sig, metadata jsonb, created_at) — append-only
- **Acceptance:**
  - [ ] Schema migrated via Supabase SQL editor; migration file in repo.
  - [ ] RLS policies: investors read own data; compliance_officer reads workspace data; admin reads all; auditor_readonly reads compliance_events + mints only.
  - [ ] Seeding script for local dev.
- **Est:** 4–5 days.

#### 3.A.2 Auth + session
- **Scope:** Replace localStorage-based KYC with Supabase session. `@supabase/ssr` cookie-based auth for Next.js App Router.
- **Acceptance:**
  - [ ] `/signup` uses Supabase auth.
  - [ ] Wallet SIWS bind verifies signature server-side.
  - [ ] `<RequireKyc>` re-implemented against server session; kept as UX guard but not the source of truth.
- **Est:** 3 days.

#### 3.A.3 Role-based server guards
- **Scope:** Every API route + sensitive page verifies session + role server-side. Helper: `requireRole(req, ['issuer','compliance_officer'])`.
- **Acceptance:**
  - [ ] Grep confirms every `/api/**/route.ts` calls the guard.
  - [ ] Page-level guards for `/tokens/[mint]` (issuer or compliance only), `/portfolio/[mint]` (any authenticated holder), `/create` (issuer only).
  - [ ] Manual test: unauthenticated curl against every route returns 401.
  - [ ] Manual test: investor role cannot reach `/api/compliance/freeze`.
- **Est:** 3 days.

#### 3.A.4 `/api/rpc` proxy
- **Scope:** Server-only `HELIUS_RPC_ENDPOINT`. Browser calls `/api/rpc` (POST, JSON-RPC body). Server forwards to Helius. Rate-limited (Upstash Ratelimit) per-session.
- **Acceptance:**
  - [ ] `NEXT_PUBLIC_RPC_ENDPOINT` removed from env template.
  - [ ] Browser bundle contains no Helius URL (verified via build output grep).
  - [ ] Rate-limit kicks in at 60 req/min per session.
- **Est:** 1 day.

#### 3.A.5 Append-only compliance audit log
- **Scope:** Phase 2 already hits an endpoint; Phase 3 backs it with the Postgres `compliance_events` table + auditor role. RLS prevents UPDATE/DELETE. Exported in audit pack.
- **Acceptance:**
  - [ ] Log entries immutable (RLS test confirms).
  - [ ] Auditor role can read all compliance_events for workspaces they're assigned to.
  - [ ] Audit pack includes `compliance_log.csv` pulled from server, not localStorage.
- **Est:** 2 days (includes Phase 2.B.3 upgrade path).

#### 3.A.6 Rate limiting on mutating routes
- **Scope:** Upstash Ratelimit. 60 req/min for authenticated routes, 10 req/min for public routes (`/api/mints/register`).
- **Est:** 4 hours.

#### 3.A.7 Monitoring (Sentry)
- **Scope:** Frontend + API routes. Alert on 5xx, Solana RPC errors, KYC webhook failures, background-job failures.
- **Est:** 2 hours.

### 3.B Identity & compliance (Weeks 3–5)

#### 3.B.1 Persona KYC integration
- **Scope:** Replace mock signup step 2 with Persona Inquiry (hosted or embedded). Webhook `POST /api/kyc/persona/webhook` verifies signature, flips `users.kyc_status` to `approved` or `rejected` with reason. Keep 3-step wizard shape.
- **Acceptance:**
  - [ ] Real doc verification + liveness runs on a test investor.
  - [ ] Webhook handler idempotent.
  - [ ] KYC failure states surfaced in UI (rejected, expired, re-submit).
  - [ ] PII stored in Supabase with RLS; never in localStorage.
- **Est:** 1.5 weeks.

#### 3.B.2 Accredited-investor verification
- **Scope:** Separate flow from identity KYC. Persona Accreditation module or VerifyInvestor.com. Status pill on investor profile: `accredited | non_accredited | expired | not_verified`. Required for Reg D 506(c) offerings.
- **Acceptance:**
  - [ ] Investor can complete accreditation flow.
  - [ ] Issuer-side filter: "hide non-accredited" toggle on reconciliation and onboarding screens.
  - [ ] Accreditation expiry tracked (typically 90 days for US Reg D 506(c)).
- **Est:** 1 week.

#### 3.B.3 KYC portability
- **Scope:** Investor KYC'd for issuer A can grant issuer B access without re-submitting. Server-side attestation with expiry.
- **Acceptance:**
  - [ ] Investor grants issuer B access from profile UI.
  - [ ] Issuer B onboarding shows investor as "KYC approved (via issuer A)".
  - [ ] Attestation expires after 1 year or on KYC refresh.
- **Est:** 3 days.

### 3.C Custody & authority governance (Week 5–6)

#### 3.C.1 Squads multisig required on mainnet
- **Scope:** Phase 2 shipped the wizard option. Phase 3 enforces it on mainnet. `/api/mints/register` rejects non-multisig mint/freeze/permanent-delegate authorities when `chain=solana-mainnet`.
- **Acceptance:**
  - [ ] Mainnet registration with single-key authority returns 403 with clear message.
  - [ ] Devnet unchanged (single-key allowed for testing).
- **Est:** 2 days.

#### 3.C.2 Fireblocks integration runbook
- **Scope:** Document-only. Verified onboarding steps for an issuer using Fireblocks custody. No code.
- **Est:** 4 hours.

### 3.D Mainnet deploy (Week 6–7)

#### 3.D.1 Helius paid-tier + allowed-domains
- Developer plan ($49/mo). Mainnet endpoint. Allowed-domains: production + `*.vercel.app`. **Est:** 15 min.

#### 3.D.2 Rotate leaked secrets
- Pinata JWT + Helius key pasted into chat during Phase 1. Rotate both. **Est:** 15 min. **Blocker: cannot go public without this.**

#### 3.D.3 Env flip + smoke test on mainnet
- `NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta`. Run Playwright smoke suite against mainnet with a burner wallet funded with $2 in SOL. **Est:** 2 days including QA.

#### 3.D.4 Custom domain + SSL
- `atlas.cipherion.com` (or chosen domain). **Est:** 15 min.

#### 3.D.5 Marketing copy audit
- Landing page claims "Live on Solana · Base · Avalanche · Ethereum" but only Solana ships. Walk back to "Solana today, Base Q3 2026" or similar honest framing. Any fund GC catches this in diligence — it converts from "positioning" to "trust issue."
- **Acceptance:**
  - [ ] Grep of marketing pages for "live on" / "supported" claims verified against actual state.
  - [ ] Aspirational chains labeled "Coming soon" with target date.
- **Est:** 2 hours.

### Phase 3 total effort
~6–8 weeks with two engineers. Business/legal track runs in parallel with a 4–12 week lead time — do not let it start late.

---

## 💼 Business & Legal Track (parallel to Phase 3)

Each of these gates public production. Start immediately.

| Item | Owner | Lead time | Status |
|---|---|---|---|
| Broker-dealer partner selection + contract | Founder / BD | 4–12 weeks | Not started. Shortlist: North Capital, Dalmore, Entoro. |
| Legal opinion on tokenization structure | Outside counsel | 4–8 weeks | Not started. Needs counsel with tokenization experience. |
| E&O + cyber insurance | Risk broker | 6–10 weeks | Not started. Insurer will ask about multisig, custody, incident response — answer with Phase 3 posture. |
| Compliance officer (hire or fractional) | Founder | 2–6 weeks | Required for SEC-registered offerings. |
| ATS partnership (Securitize Markets / INX.one / tZERO / SDX) | Founder / BD | 8–16 weeks | Phase 4 blocker, not Phase 3. Start conversations now. |
| First pilot issuer signed | Founder / BD | Ongoing | Target: $50–200M AUM manager willing to run first mainnet issuance. |

---

## Decision points — lock in before Phase 3 starts

These are product/strategy choices that change the Phase 3 scope. Decide, document the rationale, update `ATLAS_HANDOFF.md`.

1. **Backend platform.** Recommended: Supabase. Rationale: auth + Postgres + RLS + Vercel integration in one step; matches existing Upstash-via-Vercel pattern; Supabase skill already installed in this environment.
2. **KYC vendor.** Recommended: Persona. Rationale: best mid-market pricing, US/EU/APAC coverage, has an Accreditation module (one vendor, one contract). Alternatives: Synaps (crypto-native, weaker US), Civic (wallet-centric, weaker docs).
3. **Broker-dealer partner.** Start outreach to all three shortlisted now. First-call lead time is 1–2 weeks.
4. **Custody default in onboarding.** Recommended: Fireblocks for institutional ($100M+), Squads for prosumer (<$100M). Onboarding advisor suggests based on AUM input.
5. **EVM standard.** Recommended: ERC-3643 / T-REX. Rationale: $32B issued, open standard, multi-chain by design.
6. **First pilot issuer profile.** Unlocked by BD track. Drives Phase 4 prioritization — treasury-fund pilot doesn't need waterfall; real-estate pilot does.

---

## Summary — critical path to public production

```
Week 0     ├─ Phase 2 starts. BD outreach starts (broker-dealer, KYC vendor demos).
Week 1     │  Chain abstraction + Advisor + test baseline in parallel.
Week 2     ├─ Phase 2 complete. Pilot-ready demo.
Week 2     ├─ Phase 3 starts. Supabase provisioned, schema migrated.
Week 3–5   │  Auth, guards, RPC proxy, persistence migration.
Week 3–5   │  Persona KYC + accreditation integration.
Week 5–6   │  Squads enforcement, Fireblocks runbook.
Week 6–7   ├─ Mainnet deploy + smoke test + marketing walkback.
Week 4–12  │  💼 Broker-dealer signed, legal opinion, insurance.
Week 8–10  ├─ First pilot issuer onboarding on mainnet.
Post       │  Phase 4: Transfer Hook, EVM, waterfall, tax reporting, secondary market.
```

**The tightest gate is the broker-dealer partner**, not the code. Start that conversation this week regardless of which Phase 2 item the team picks up first.
