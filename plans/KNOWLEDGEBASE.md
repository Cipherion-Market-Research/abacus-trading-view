# CipheX Atlas — Knowledgebase

**Last updated:** 2026-04-23 (remediation sprint)
**Purpose:** Forward-looking active-concerns doc for incoming agents. What's fragile, what was audited, what decisions were made and why, what to verify before trusting older docs. Complements `ATLAS_HANDOFF.md` (current state) and `ROADMAP.md` (prioritized work).

---

## 1. Active concerns — things shipped but imperfect

These are known issues in the current codebase. None are blockers for the demo flow; all should be closed before Phase 3.

### 1.1 ~~`canonicalHash` is shallow~~ ✅ FIXED

**Fixed in:** remediation sprint 2026-04-21. Recursive `canonical()` function now sorts keys at every depth. Also landed SETNX-based dedup (see Round 7 in §3).

### 1.2 Authority model disagreement between code and older docs

**Reality (code):** every authority on every Atlas-created mint hardcoded to `payer` (connected wallet). See `ATLAS_HANDOFF.md` §"Authority Model."
**Older docs claim:** editable mint/freeze/permanent-delegate pubkeys in Step 3 of the wizard.
**Resolution:** the `wizard-steps/supply-step.tsx` Authorities panel is read-only. No `<input>` elements. No Squads multisig path at creation.
**Impact on demo script:** don't pitch "you can set authority to your Squads vault at creation" — it's not true today. Phase 2.A.1 adds the pubkey input.
**Action:** if you find any doc or marketing page claiming configurable authorities, correct it before the next pitch meeting.

### 1.3 Pending-sync flags are localStorage-only

**Current behavior:** When a user rejects the Phase 2.B post-distribution server-persist sign, the record is marked `serverSync: "pending"` in localStorage. A yellow banner appears on the Distributions tab.
**Gap:** the flag doesn't follow the wallet. If the user opens the same wallet on a different device, the banner is gone and there's no indication the earlier record never reached the server.
**Rare in a controlled demo.** Worth flagging in `DEMO_SCRIPT.md` when it's refreshed (Phase 2.E.1).
**Phase 3 fix:** Supabase row with `sync_status` column, queried per-user not per-device.

### 1.4 GET routes have no auth

`/api/distributions/list`, `/api/reconciliation/register` (GET), `/api/mints/list` all return data without auth. For demo attendees this means anyone scraping your Vercel URL can enumerate issuers' distribution history and holder lists.

**Acceptable for Phase 2 devnet demo.** Phase 3 adds session-based auth (any authenticated user can read; unauthenticated → 401).

### 1.5 No rate limiting on mutating routes (except `/api/demo/reset`)

`/api/distributions/record`, `/api/reconciliation/register`, `/api/mints/register`, `/api/ipfs/upload` have no rate limits. A legitimate-wallet attacker can burn the Upstash free-tier command budget in a few minutes. All four routes now require wallet signature auth (mints/register added in remediation sprint), but rate limits are still absent.

**Phase 3 fix:** Upstash Ratelimit on every mutating route. 60 req/min for authenticated, 10 req/min for public.

### 1.6 21 `console.log` statements in production bundle

**Location:** 9 files, led by `token-service.ts` (5 debug logs) and `use-send-transaction.ts` (simulation pass/skip).
**Scope:** Phase 2.D.3 cleanup item. Replace with a `debug(scope, msg, data?)` helper gated by `NEXT_PUBLIC_DEBUG`. Keep intentional error logs.

### 1.7 Zero test coverage

No Jest, no Vitest, no Playwright. Pure functions (`reconcile`, `audit-pack`, `compliance-simulator` rules, `computeAllocations`) are the highest-leverage targets. Phase 2.D.1 (~2 days) targets 90% branch coverage on those four modules.

### 1.8 Canonical-creator = mint-authority coupling

Every on-chain check in server routes uses `mintAuthority` as the identity. Every current Atlas flow sets `mintAuthority = creator`. If Phase 2.A.3 (authority rotation) lands without updating the registration/distribution routes to track "creator" separately from "current mint authority," behavior will silently change in ways that may surprise.

**Action:** when authority rotation ships, explicitly decide whether:
- Distribution record writes require *current* mint authority (rotates as authority rotates — default today), or
- Distribution record writes require *original creator* (registered once, forever)

Recommend option 1. Document the decision in the route's header comment.

### 1.9 Marketing claim / product mismatch

Landing page: "Live on Solana · Base · Avalanche · Ethereum." Product: Solana-only.
**Status:** deliberate positioning choice by the user. A fund's general counsel will catch this in diligence and it becomes a trust issue.
**Recommended walk-back:** "Solana today, Base Q3 2026" or similar. Phase 3 pre-production pass (see `PRE_PRODUCTION_CHECKLIST.md` §3.D.5).

---

## 2. Decisions made — what was considered and rejected

Captured so the next agent doesn't re-litigate these.

### 2.1 Upstash over Supabase for Phase 2.B server persistence

**Rejected alternative:** ship Supabase now for distributions + registers.
**Reason:** Supabase is the right Phase 3 backend (auth + RLS + relational queries). Introducing it for Phase 2.B means two database integrations to maintain before the backend that actually needs Supabase (auth + roles) is built. Upstash was already provisioned, data shapes (append-only arrays + per-mint JSON blobs) map naturally to Redis.
**Migration path:** Phase 3 migration is a read-from-Upstash-write-to-Postgres one-time script. Tiny, well-scoped.

### 2.2 Wallet-signed auth over admin-key gating for `/api/demo/reset`

**Rejected alternative:** `DEMO_ADMIN_KEY` env var + `X-Demo-Admin-Key` header.
**Reason:** initial "client calls `/api/admin/key` to fetch the secret, then passes it to flush routes" pattern leaks the server-only secret to the browser. Inverting to "client calls `/api/demo/reset` unauthenticated, server does flushing internally" kept the secret server-side but dropped the auth gate entirely. The cleanest fix was removing the key concept entirely and gating the reset with a wallet signature.
**Trade-off accepted:** any wallet can reset (not authority-gated). On devnet this is fine. Attribution via structured logs.

### 2.3 Option 2 for failed distributions (accept with signed-message auth)

**Rejected alternative 1:** reject zero-signature records (failed distributions are localStorage-only).
**Rejected alternative 2:** synthetic "intent only" flag.
**Chosen:** any Zod-valid record signed by the mint authority is accepted. Failed distributions *are* audit-trail-worthy ("issuer tried to distribute, nothing confirmed").
**Known limitation:** a malicious mint authority can fabricate records. Acceptable because the mint authority *is* the issuer and has no incentive to lie to their own audit log. Phase 4 Transfer Hook would cross-reference; Phase 3 Postgres adds schema-level integrity.

### 2.4 Option B for `loadDistributions` refactor (keep sync, add hook)

**Rejected alternative:** make `loadDistributions` async and update 6 callers.
**Chosen:** keep `loadDistributions` as the sync localStorage-only reader; add `useDistributions(mint)` hook that does server fetch + merge + cache backfill; add `fetchDistributionsFromServer` as the direct async helper (used by audit-pack).
**Reason:** minimal blast radius. Yield ticker and audit-pack fallback need sync access and don't want a loading state.

### 2.5 Redis List over JSON-string-array for distributions

**Rejected alternative:** `SET atlas:dist:<mint>` with JSON-stringified array, read-modify-write.
**Reason:** concurrent writes cause a race between read-modify-write sequences — one record lost.
**Chosen:** `LPUSH` into `atlas:dist:<mint>` as a Redis List. Atomic append, naturally ordered, O(1) read via `LRANGE`.

### 2.6 Signed-message auth uniformly across routes

**Rejected alternative:** mixed model (signed-message for register, tx-sig-validated-only for distribution).
**Reason:** two auth models = future maintenance tax. 40 minutes saved at most.
**Chosen:** `verifyWalletSignature(auth, purpose, mint)` on every write route. Single helper, single pattern, single file.

### 2.7 Separate flush routes over a single mega-flush

**Deprecated:** originally planned `/api/distributions/flush` + `/api/reconciliation/flush` with admin-key gating.
**Final:** folded into one `/api/demo/reset` that handles catalog + distributions + registers. Admin-key concept dropped entirely (see 2.2).

---

## 3. Session audit trail (2026-04-21 → 2026-04-23)

Condensed history of what was audited, what was found, what shipped.

### Round 1 — Codebase audit against claims

- Verified Track A features are real (compliance simulator 5-rule engine, audit pack ZIP, reconciliation diff, holder detail view).
- Found: zero server-side auth on any API route. KYC is localStorage. `<RequireKyc>` is client-side-only. Solana hardcoded across `lib/solana/`. Zero test coverage. 21 `console.log`s.
- Original `ROADMAP.md` had stale references (e.g., `pillars-test/page.tsx` already removed in commit `170d7e2`).

### Round 2 — Strategic review

- Restructured roadmap from Track B/C/D labels into Phase 2 (Demo Completion, ~2 wks) / Phase 3 (Pre-Production, ~6–8 wks) / Phase 4 (Differentiation, 3–5 months post-Phase 3).
- Separated business/legal track (broker-dealer partner, legal opinion, insurance) from product track.
- Multi-chain design: per-workspace chain default + Chain Advisor flow + per-token override. Two compliance code paths (Token-2022 on Solana, ERC-3643 on every EVM target).
- Identified "$50–300M AUM" as the defensible niche vs Securitize's $500M+ pricing.

### Round 3 — Dev pushback on Round 2

- Accepted: Supabase compresses backend work to 2–3 weeks; `pillars-test` already removed; chain abstraction at 3–5 days; broker-dealer belongs on business track.
- Held: test coverage, accredited-investor verification separate from KYC, Squads multisig explicitly scoped, audit-trail durability non-negotiable.
- Created `PRE_PRODUCTION_CHECKLIST.md` with acceptance criteria per item.

### Round 4 — Phase 2.B design

- Dev proposed persist distributions + reconciliation to Upstash. Good architecture, 1.5 day estimate.
- Flagged 4 issues: unauthenticated write routes, optimistic fire-and-forget for audit trail, JSON-string-array concurrency race, unguarded flush routes.
- Answered 3 dev questions: overwrite-with-counter for register versions (not full history); idempotent dedup by id; separate flush routes.

### Round 5 — Phase 2.B revised spec

- Dev addressed: Redis List + LPUSH, `INCR` version counter, Zod schemas, pending-sync banner, CSV header + filename versioning, fall-back-with-warning in audit pack.
- 2 remaining security concerns flagged: caller identity not actually verified (body claims wallet, server trusts claim), `/api/admin/key` leaks the secret.
- Fixes: signed-message auth challenge (`tweetnacl`, nonce `SETNX`, timestamp window), invert flush-route auth (client→`/api/demo/reset`, server does flushing internally).

### Round 6 — Phase 2.B first implementation

- Dev reported "build passes clean." Verified directly. Found 3 real issues:
  1. `/api/demo/reset` had ZERO auth on devnet (inversion removed key leak AND the gate).
  2. Dedup race window between `LRANGE` and `LPUSH` — concurrent writes could duplicate.
  3. `verifyWalletSignature` silently skipped replay check when registry unconfigured.

### Round 7 — Phase 2.B fixes

- `/api/demo/reset` now requires wallet signature with `purpose: "demo-reset"`, rate-limited 1/hr on non-devnet.
- Dedup replaced with `SETNX atlas:dist:<mint>:id:<id>` holding SHA-256 canonical-JSON hash, 90-day TTL, O(1).
- `verifyWalletSignature` returns 503 on missing registry (fail-loud), with `skipReplayCheck` opt-out.
- Minor concern: `canonicalHash` is shallow (see §1.1 above).

### Round 8 — Demo tutorial + audit corrections

- Wrote demo tutorial. Auditor found 3 factual errors:
  1. Pause authority doesn't "inherit from freeze" — it's independently hardcoded to `payer`.
  2. Reset route is wallet-signed but NOT authority-gated — any connected wallet can reset.
  3. Demo Part 8 step 1 had the same wrong implication.
- Further investigation revealed a bigger issue: NONE of the authorities are editable in the wizard, not just pause. Supply step is read-only "Authorities (auto-assigned)" display.
- Also fixed: silent-divergence reset (wallet-disconnected → partial reset) and 1/hr rate limit too tight for demo prep (now devnet-exempt).

### Round 9 — Handoff refactor

- Rewrote `ATLAS_HANDOFF.md` with Phase 2.B patterns, accurate authority model, updated API surface, new "Server Persistence" and "Authority Model" sections.
- Created this `KNOWLEDGEBASE.md` for forward-looking concerns.

### Round 10 — External auditor critical analysis + remediation sprint (2026-04-23)

**External auditor identified two confirmed bugs:**

1. **Compliance simulator pause-state misreporting** — `compliance-simulator.tsx:35` read `token.extensions.pausable` (capability flag: "this token has the PausableConfig extension") as if it meant "the token is currently paused." A token with PausableConfig enabled but NOT paused would falsely report BLOCKED.
   - **Fix:** Added `isPaused: boolean` to `TokenInfo`. `getTokenInfo()` now calls `getPausableConfig(mintAccount)` and reads the on-chain `paused` field. Compliance simulator reads `token.isPaused`.

2. **`getTokenInfo()` defaultAccountState misclassification** — `token-service.ts:323-326` assumed `freezeAuthority` existence = `DefaultAccountState: frozen`. But `createRwaToken()` ALWAYS sets a freeze authority (line 200) even without KYC gating. Every Atlas token was misclassified as having DefaultAccountState=Frozen.
   - **Fix:** `getTokenInfo()` now calls `getDefaultAccountState(mintAccount)` and checks actual `state === AccountState.Frozen`. Also fixed same bug in `mintTokens()` (line 378-383) which would fail thawing non-frozen ATAs.

**Additional remediation in same sprint:**

3. **`/api/mints/register` had no wallet auth** — body field `creator` was trusted without cryptographic verification. Any HTTP client could register arbitrary metadata for any mint. Fixed: route now requires `{ input, auth }` with `verifyWalletSignature(auth, "register-mint", mint)` + on-chain mint authority check.

4. **500 error responses leaked internal details** — `err.message` was returned to clients in distributions/list, reconciliation/register, mints/list, demo/reset, ipfs/upload. Fixed: generic error messages, internal details logged server-side only.

5. **GET query params unvalidated** — `?mint=` on distributions/list and reconciliation/register was string-only null check. Fixed: Zod `z.string().min(32).max(44)` validation.

---

## 4. Fragile spots the next agent should verify before trusting

1. **Authority model in any doc.** Verify against `supply-step.tsx` + `token-service.ts:184–203`. If a doc claims editable mint/freeze authorities at creation, it's wrong.
2. **API route list in any doc.** `/api/mints/flush` was removed. Replaced by `/api/demo/reset`. Check each referenced route exists.
3. **Demo script beats.** `DEMO_SCRIPT.md` pre-dates Track A, Track B, and Phase 2.B. Phase 2.E.1 will refresh it. Until then, don't follow it verbatim — every distribution now has an extra wallet sign (server-persistence auth) that old scripts don't mention.
4. **"Multi-chain live today" in landing copy.** Solana-only. Deliberate positioning. Walk back for Phase 3.
5. **Any estimate older than Round 9.** Roadmap estimates were tightened after dev review:
   - Backend = Supabase = 2–3 weeks (not 5 as originally pessimistic)
   - Transfer Hook = 6+ weeks (not 2–4 as originally optimistic)
   - Chain abstraction refactor = 3–5 days (not 1 week)

---

## 5. Recommended guardrails for the next agent

### When reviewing dev claims

1. **"Build passes clean" is not verification.** Type-check can't catch security holes, concurrency races, or silent fallbacks. Actually read the implementation.
2. **Verify auth on write routes.** Every `POST` route that mutates Upstash must verify a wallet signature via `verifyWalletSignature`. As of Round 10, all four write routes have wallet signature auth. The three mint-scoped routes (`/api/mints/register`, `/api/distributions/record`, `/api/reconciliation/register`) also enforce on-chain mint authority. `/api/demo/reset` is wallet-signed but intentionally not authority-gated (any wallet can reset on devnet). If a new route is added without wallet auth, flag it.
3. **Check for read-modify-write on Redis.** If you see `.get()` → mutate → `.set()`, that's a race. Use atomic ops (`LPUSH`, `INCR`, `SETNX`).
4. **Check secret exposure.** Grep for any route that returns `process.env.*` values to the client. `NEXT_PUBLIC_*` prefixed vars are fine; anything else should never leave the server.

### When writing new features

1. **Use `verifyWalletSignature` for new write routes.** It handles signature + timestamp + nonce + replay in one call. Pass a distinct `purpose` string for each route so the signed message can't be cross-route replayed.
2. **Structured logs on every write:** `console.info({ event, chain, mint, actor, ... })`. Phase 3 Sentry will pipe these in without rework. Include `chain` even though it's always Solana today.
3. **Zod schemas in `lib/api/schemas.ts`.** Shared between client and server. Don't duplicate validation logic in routes.
4. **Fail loud, never fake.** Silent fallbacks to mock/localStorage are explicitly disallowed. Banner warnings, console errors, or hard failures — never silent degradation.

### When updating docs

1. **Update `ATLAS_HANDOFF.md` Build Status table** when a phase ships.
2. **Update `ROADMAP.md` phase sections** when scope changes; "Next-session priorities" at the bottom.
3. **Update this file (`KNOWLEDGEBASE.md`) §1** when new fragile spots are discovered; §3 when new audit rounds happen.
4. **Don't rewrite historical sections** in `RWA_TOKEN_PLATFORM_PROPOSAL.md` or similar — those are historical records.

---

## 6. Suggested first commands for a cold agent

```bash
# Verify you're on main
git status && git log --oneline -10

# Verify the codebase builds
cd cipherion-tokenize && npm install && npm run build && npx tsc --noEmit

# Verify authority model claim
grep -n "payer\|mintAuthority\|freezeAuthority" src/lib/solana/token-service.ts | head -20

# Verify Phase 2.B routes exist
ls src/app/api/demo/reset/route.ts src/app/api/distributions/record/route.ts src/app/api/reconciliation/register/route.ts

# Verify old flush route is gone
test -f src/app/api/mints/flush/route.ts && echo "STALE — flush still exists" || echo "Clean — flush removed"

# Verify wallet-auth is in place
head -30 src/lib/api/wallet-auth.ts

# Count outstanding debug logs (should be 21, target Phase 2.D.3)
grep -rn "console.log" src --include="*.ts" --include="*.tsx" | wc -l
```

If any of the above returns unexpected output, the docs are stale — update them before proceeding.
