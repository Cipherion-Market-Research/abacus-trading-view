# Track A — Demo Polish + Holder View

**Scope:** 4 features that strengthen both sides of a 30-minute institutional walkthrough.  
**Estimated total:** ~8 hours  
**Depends on:** Nothing — all features build on the current shipped state (Phase 1G).

---

## Feature 1: Compliance Pre-Trade Simulator

**Location:** New section on the existing Compliance tab (`/tokens/[mint]` > Compliance)  
**Estimate:** 1.5 hours  
**Why it matters:** Counterparties ask "what happens if an unapproved wallet tries to receive tokens?" This answers that visually — T-REX-style enforceability demo without needing the Transfer Hook deployed.

### What it does

A text input at the top of the Compliance tab: paste a wallet address, get an instant green/red verdict with the specific rule(s) that fired.

### Rules engine (client-side, simulated)

| # | Rule | Check | Verdict |
|---|------|-------|---------|
| 1 | Wallet is token holder | `holders.find(h => h.owner === input)` | Info — already onboarded |
| 2 | Account is frozen | holder exists + `isFrozen === true` | BLOCKED — account frozen |
| 3 | Token is paused | `token.isPaused` (from mint data) | BLOCKED — all transfers paused |
| 4 | No KYC on file | Check if wallet has no ATA for this mint | BLOCKED — investor not onboarded (no ATA) |
| 5 | Investor cap exceeded | `holders.length >= maxHolders` (read from metadata if present) | BLOCKED — investor cap reached |
| 6 | Max balance exceeded | metadata `max_balance` field vs. proposed transfer | BLOCKED — would exceed per-wallet cap |
| 7 | All clear | None of the above triggered | APPROVED — transfer would succeed |

### UI sketch

```
┌─────────────────────────────────────────────────────┐
│  Simulate a transfer                                │
│  ┌─────────────────────────────────┐  [Check]       │
│  │ Paste wallet address...         │                │
│  └─────────────────────────────────┘                │
│                                                     │
│  ● BLOCKED — Account frozen                         │
│    Rule: Freeze authority has suspended this wallet  │
│    Holder: 7xK...9mP · Balance: 1,250 REIT          │
│                                                     │
│  ○ Investor cap: 3 of 50 (passed)                   │
│  ○ Per-wallet max: no cap configured                │
│  ○ Token paused: no                                 │
└─────────────────────────────────────────────────────┘
```

### Files touched

| File | Change |
|------|--------|
| `src/components/compliance/compliance-simulator.tsx` | **New** — input + rules engine + verdict display |
| `src/components/compliance/compliance-panel.tsx` | Add `<ComplianceSimulator>` above existing Account Actions section |

### Open questions

- [ ] Should the simulator accept an optional "amount" field to check per-wallet cap, or just address-only for v1? Address-only for v1
- [ ] Should it also show a "would this wallet receive distributions?" check (i.e., non-frozen + non-zero balance)? Sure

---

## Feature 2: Regulator-Ready Blotter Export (Audit Pack)

**Location:** New button on `/tokens/[mint]` header area  
**Estimate:** 1.5 hours  
**Why it matters:** Institutional counterparties expect a one-click way to produce an audit-ready document pack. Currently we have CSV export for transactions only — this bundles everything.

### What it produces

A ZIP file named `Atlas_Audit_Pack_{SYMBOL}_{DATE}.zip` containing:

| File | Contents |
|------|----------|
| `holders.csv` | Owner address, ATA address, balance, % supply, frozen status |
| `transactions.csv` | Existing CSV export (signature, timestamp, type, memo) — expanded to fetch ALL available transactions, not just the first 10 |
| `distributions.csv` | All distribution records: date, memo, total allocated, per-recipient breakdown |
| `token_metadata.json` | Full token info snapshot: name, symbol, supply, decimals, authorities, all metadata fields, extensions |
| `README.txt` | Header with token name, mint address, export timestamp, network (devnet/mainnet), Atlas version, and a disclaimer that on-chain state is the source of truth |

### Dependencies

- **`jszip`** — need to add this package (small, well-maintained, no native deps)
- Existing `generateCsv` / `downloadCsv` utilities in `src/lib/utils/csv.ts`
- Existing `loadDistributions()` from `src/lib/distributions.ts`
- Existing `useHistory` hook (will need to fetch all pages, not just first 10)

### Files touched

| File | Change |
|------|--------|
| `src/lib/utils/audit-pack.ts` | **New** — orchestrates data collection + ZIP assembly |
| `src/components/shared/audit-pack-button.tsx` | **New** — button component with loading state |
| `src/app/tokens/[mint]/page.tsx` | Add AuditPackButton to the page header actions |
| `src/hooks/use-history.ts` | Add a `fetchAll()` method that paginates through all signatures |
| `package.json` | Add `jszip` dependency |

### Open questions

- [ ] Should the audit pack also include a PDF summary, or is CSV + JSON sufficient for v1? CSV and JSON is good enough for now
- [ ] Should we cap the transaction fetch at some limit (e.g., 500) to avoid RPC hammering on devnet, or fetch everything? yes, 500 for start
- [ ] Include distribution allocation details per-recipient, or just summary rows? I'm not sure here, what is available?

---

## Feature 3: Reconciliation View

**Location:** New tab on `/tokens/[mint]` — "Reconciliation" (after Distributions, before History)  
**Estimate:** 2 hours  
**Why it matters:** Counterparty's #1 stated pain point. Fund admins need to compare their internal investor register against on-chain state and see discrepancies instantly.

### What it does

Side-by-side comparison: **on-chain holders** (live from Solana) vs. **official register** (uploaded CSV or manually entered). Highlights discrepancies: missing from chain, missing from register, balance mismatches, status mismatches.

### Flow

1. Left column auto-populates from live on-chain holder data (same as Cap Table)
2. Right column: upload a CSV or paste entries manually
   - CSV format: `wallet_address, expected_balance, expected_status`
   - Manual: add rows via a small form (address + balance + active/frozen)
3. Center column: diff results
   - Green rows: match
   - Yellow rows: balance mismatch (shows delta)
   - Red rows: present on one side but not the other

### UI sketch

```
┌──────────────────┬──────────────┬──────────────────┐
│  On-Chain (live)  │    Status    │ Official Register │
├──────────────────┼──────────────┼──────────────────┤
│ 7xK...9mP        │   ✓ Match    │ 7xK...9mP        │
│ 1,250 · Active    │              │ 1,250 · Active    │
├──────────────────┼──────────────┼──────────────────┤
│ 3bR...7nQ        │ ⚠ Balance    │ 3bR...7nQ        │
│ 800 · Active      │  Δ +50       │ 750 · Active      │
├──────────────────┼──────────────┼──────────────────┤
│ —                 │ ✗ Missing    │ 9pL...2xF        │
│                   │  on-chain    │ 500 · Active      │
├──────────────────┼──────────────┼──────────────────┤
│ 5mT...8kJ        │ ✗ Missing    │ —                 │
│ 200 · Frozen      │  from register│                  │
└──────────────────┴──────────────┴──────────────────┘

Summary: 12 matched · 2 balance mismatches · 1 missing on-chain · 1 unregistered
[Upload CSV]  [Export diff as CSV]
```

### Files touched

| File | Change |
|------|--------|
| `src/components/reconciliation/reconciliation-panel.tsx` | **New** — main panel with upload, diff engine, results table |
| `src/components/reconciliation/register-upload.tsx` | **New** — CSV parser + manual entry form |
| `src/lib/utils/reconcile.ts` | **New** — pure function: `reconcile(onChain: HolderInfo[], register: RegisterEntry[]) => DiffResult[]` |
| `src/app/tokens/[mint]/page.tsx` | Add Reconciliation tab |

### Open questions

- [ ] Should the register persist to localStorage so it survives page reloads, or is ephemeral (upload each time) fine for demo? What is best practices given the architecture and roadmap to mainnet and multi chain?
- [ ] Should we support pasting a register from clipboard (tab-separated) in addition to CSV upload? I'm not sure.
- [ ] Include a "Sync" action that onboards missing wallets (create ATA) directly from the diff view? Sure.

---

## Feature 4: Holder View (Phase 1H)

**Location:** New route `/portfolio/[mint]` + enhancements to `/portfolio`  
**Estimate:** 3 hours  
**Why it matters:** The addendum explicitly calls for "investor portal separate from issuer dashboard." During a walkthrough, you demo the issuer side on `/tokens/[mint]`, then switch wallets (or open a second browser) and show the investor what *they* see. Two sides of the same coin.

### What the holder sees at `/portfolio/[mint]`

A read-only, investor-facing detail page for a single held token. No compliance actions, no cap table — just *my position*.

### Sections

| Section | Data source | Notes |
|---------|-------------|-------|
| **Position summary** | `usePortfolio` (filtered to this mint) | Balance, % of supply, frozen/active status, asset type badge |
| **NAV & valuation** | Token metadata `nav_per_token` | Per-token NAV, total position value, issuer-attested badge (reuse `NavDisplay`) |
| **Yield accrual** | `YieldTicker` (already built) | Live per-second accrual for this holder's balance, not total supply |
| **My distributions** | `loadDistributions(mint)` filtered to connected wallet | Only shows distributions where this wallet was a recipient, with amounts received |
| **Token info** | `useTokenInfo` | Name, symbol, issuer (mint authority), total supply, metadata fields — read-only |
| **Recent activity** | `useHistory` filtered or scoped | Transactions involving this wallet's ATA for this mint |

### Key difference from `/tokens/[mint]`

| Aspect | `/tokens/[mint]` (issuer) | `/portfolio/[mint]` (holder) |
|--------|--------------------------|------------------------------|
| Cap table | Full holder list | Not shown |
| Compliance actions | Freeze/thaw/burn | Not available |
| Distributions | Create + history (all recipients) | My receipts only |
| Yield ticker | Accrual on total supply | Accrual on *my* balance |
| Reconciliation | Upload register, run diff | Not shown |
| Redemption | Not here (on `/portfolio`) | "Redeem at NAV" button available |

### Yield ticker adaptation

Currently `YieldTicker` computes accrual on `supply` (total). For the holder view, we pass the holder's balance instead:

```
perSecondForMe = (myBalance / 10^decimals) * couponRate / 100 / (365 * 86400)
```

This means adding an optional `balanceOverride` prop to `YieldTicker`, or computing it in the parent and passing a display value.

### Distribution filtering

`loadDistributions(mint)` returns all records. For the holder view, filter:

```ts
records
  .map(r => ({
    ...r,
    recipients: r.recipients.filter(
      rec => rec.ownerAddress === connectedWallet
    ),
  }))
  .filter(r => r.recipients.length > 0)
```

Show: date, memo, amount received, tx signature link.

### Files touched

| File | Change |
|------|--------|
| `src/app/portfolio/[mint]/page.tsx` | **New** — holder detail route |
| `src/components/portfolio/holder-position.tsx` | **New** — position summary + NAV + yield |
| `src/components/portfolio/my-distributions.tsx` | **New** — filtered distribution history |
| `src/components/token/yield-ticker.tsx` | Add optional `balanceOverride?: bigint` prop |
| `src/app/portfolio/page.tsx` | Make token rows link to `/portfolio/[mint]` |

### Open questions

- [ ] Should the holder view include a "Transfer" action (send tokens to another approved wallet), or keep that on the portfolio list page only? What is common-place amongst our competitors or what do regulations allow for this?
- [ ] Should `/explorer/[mint]` link to `/portfolio/[mint]` when the connected wallet holds the token? (contextual "View my position" link) I think so, right?
- [ ] Should we show a simplified transaction history scoped to this wallet, or defer that to a later pass? Later pass, unless this is easy to design/develop

---

## Implementation Order

```
1. Compliance Simulator  (1.5h)  — standalone, no new deps
2. Audit Pack            (1.5h)  — adds jszip, expands history fetch
3. Reconciliation View   (2h)    — new tab, new pure-function diff engine
4. Holder View           (3h)    — new route, adapts existing components
```

Each feature is independently shippable. We can commit after each one.

---

## Roadmap update

After this sprint, the "Priorities for the next session" section of `ROADMAP.md` should be updated to reflect:
- Track A items as shipped (Phase 1H)
- Holder view added as a new line item
- Next session priorities shift to Track B or Track C
