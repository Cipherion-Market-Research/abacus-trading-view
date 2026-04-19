# Abacus Predictions — Design-System Port from Atlas

**Date:** 2026-04-18
**Source:** CipheX Atlas (`cipherion-tokenize/`) — Phases 1A–1E shipped
**Target:** Abacus Predictions (`ciphex-predictions/`)
**Status:** Brief — execute after approval

---

## What this document is

A self-contained briefing for a fresh agent. **Read this first, then read the referenced files in `cipherion-tokenize/`.** You should not need any prior chat history to execute.

The goal: bring `ciphex-predictions/` into visual + interaction parity with `cipherion-tokenize/` (Atlas) so the two products read as siblings under the CipheX brand. Same type system, same canvas color, same logo treatment family, same mobile patterns, same component primitives where they make sense.

**This is NOT a copy-paste job.** Predictions has its own product context (real-time market data, charts, live polling — see `plans/stocks-integration-proposal.md` and `plans/ABACUS_*.md` for context). The work is selectively porting what's portable and adapting where the product surface differs.

---

## Predictions context (read before starting)

- **Product**: Abacus AMS — real-time price predictions overlaid on live market data. Trading-view-style charts. Stocks integration in progress.
- **Brand**: "Abacus" by CipheX (parent brand). Title in `layout.tsx` is currently `"Abacus"`.
- **Tech stack**: Next.js 16, React 19, TypeScript, Tailwind 4, shadcn/ui, Geist + Geist Mono. Same as Atlas — already aligned at the framework level.
- **Current state**: Pre-design-system. Ad-hoc styling per component. Has `middleware.ts`, `services/`, indexer, debug routes — substantially more backend complexity than Atlas.
- **What predictions does NOT need from Atlas**:
  - KYC gate (predictions is read-mostly market data)
  - Token-creation wizard (no on-chain issuance)
  - Pinata IPFS proxy (no user uploads)
  - Upstash mint registry (different data model)
  - Solana wallet adapter (different blockchain integration if any)

---

## Design system to port (from Atlas)

### 1. Brand identity

**Atlas wordmark pattern:** `Atlas | BY CIPHEX`
- Main brand name in Geist Semibold
- Vertical separator (`border-l border-[#30363d]`)
- "BY CIPHEX" suffix in Geist Mono 9–10px uppercase, muted (`text-[#8b949e]`), letter-spacing `0.12em`

**For predictions:** apply the same pattern with `Abacus | BY CIPHEX`. Replace "Atlas" with "Abacus" in the AtlasWordmark component pattern. The CipheX parent-brand suffix is the cross-product unifier.

**Logo:** Atlas uses the **Polaris Crosshair** — concentric circles + 45°-rotated four-pointed star + white center dot. See `cipherion-tokenize/src/components/shared/atlas-logo.tsx` for the SVG.

For predictions, **do not reuse the Polaris mark** — Atlas owns it. Predictions needs its own mark in the same visual family. Options:
- **Recommended:** propose 2–3 new geometric marks for Abacus (abacus-bead motif, candlestick-cross, signal-grid). Same dark backdrop + 1.2px stroke + green accent treatment so they read as siblings.
- **Stopgap:** until a mark is designed, use the bare wordmark "Abacus by CipheX" with no glyph.

This is a brand decision, not a code one. Surface options to the user before building.

### 2. Typography (all Geist — no serif)

| Element | Mobile | Tablet | Desktop |
|---|---|---|---|
| Hero h1 | 40px | 56px | 80px |
| Section h1 (page-level) | 36px | 52px | 68px |
| Section h2 | 26–28px | 30–32px | 36–40px |
| Dashboard page title (PageHeader) | 24px | 28px | 32px |
| Mono eyebrow (`/ section`) | 10px | 11px | 11px |
| Body lead | 14–15px | 16–17px | 17–19px |
| Body | 13–14px | 14px | 14–15px |

All display type is `font-semibold` with aggressive tight tracking (`-0.03em` to `-0.04em`). Emphasis is carried by green color accent (`#3fb950`) on pivotal words — **no italics, no serif display face**.

**Numeric data** (prices, percentages, deltas) stays Geist Mono. This is critical for predictions which is data-heavy.

### 3. Color palette (already aligned — verify)

Atlas + predictions both inherited GitHub-dark. Verify predictions uses these:

```
Canvas:       #0a0e13   (deep — Atlas unified to this in Phase 1D)
Surface 1:    #161b22   (cards)
Surface 2:    #21262d   (hover, active tabs)
Border:       #30363d
Border-strong: #484f58
FG default:   #f0f6fc
FG muted:     #8b949e
FG dim:       #6e7681
Accent green: #3fb950   (success, action, primary highlight)
Accent green-dark: #238636 → hover #2ea043 (CTAs)
Accent blue:  #58a6ff   (links, copy, info)
Accent yellow: #d29922  (warnings, pause)
Accent red:   #f85149   (destructive)
Accent purple: #a371f7  (discovery, secondary)
```

If predictions currently uses `#0d1117` for canvas, **bump it to `#0a0e13`** for parity. This was Atlas's Phase 1D change.

### 4. Component primitives to port

These are in `cipherion-tokenize/src/components/`. Read each file, port the pattern (not necessarily the exact code) into predictions.

#### `shared/page-header.tsx` — high priority
Universal page header: green mono eyebrow (`/ section`) + Geist Semibold 32px title + optional subtitle + right-action slot. Used across every dashboard page in Atlas.

```tsx
<PageHeader
  eyebrow="market overview"
  title="Today's signals"
  subtitle="Live predictions across tracked instruments."
  actions={<Button>Refresh</Button>}
/>
```

Direct port. No Atlas-specific dependencies.

#### `shared/atlas-logo.tsx` — adapt, don't copy
Component pattern (logo SVG + wordmark with attribution suffix) ports cleanly. Replace SVG content with whatever predictions' mark becomes. Replace "Atlas" string with "Abacus".

#### `landing/marketing-chrome.tsx` — adapt
`MarketingNav` + `MarketingFooter` shared between marketing pages. Has hamburger sheet for mobile (Radix Dialog). If predictions has a marketing surface, port this. Update `LINKS` array for predictions' nav structure.

#### Mobile sheet pattern (Radix Dialog)
Used in MarketingNav and AppHeader. Slide-in from right, full-screen with stacked nav links + sticky CTAs at bottom. Look at `app-header.tsx` for the dashboard variant (includes a "System status" section in the sheet).

#### Status pills + tinted accents
Pattern: `bg-[rgba(R,G,B,0.10–0.15)]` + matching `text-[<accent>]`. See cap table or KYC pill examples.

#### Page chrome conditional rendering
`AppShell` has a `MARKETING_ROUTES` Set that hides the app header on marketing pages. Same pattern useful for predictions if it has both a public surface and authenticated dashboard.

### 5. Mobile / tablet patterns

All from Phase 1E. Apply to predictions where applicable.

| Pattern | Implementation |
|---|---|
| **Hamburger nav drawer** | Radix Dialog + slide-in animation, full-height, max-w-sm. Hidden md:hidden on desktop. |
| **Responsive type sweep** | Use breakpoint-prefixed sizes everywhere. Hero 40→56→80px etc. (table above). |
| **Data tables → cards on mobile** | `hidden md:block` for table, `md:hidden` for card stack. See `cap-table.tsx`. |
| **Tabs overflow scroll** | `overflow-x-auto snap-x scrollbar-hide` on TabsList; `shrink-0 snap-start` on each TabsTrigger. |
| **iOS input zoom prevention** | Global rule in `globals.css`: `@media (max-width: 639px) { input/select/textarea { font-size: 16px } }`. Critical for predictions if it has any forms. |
| **Touch targets** | 36px+ minimum on mobile (44px+ for primary actions). |
| **Stat cells (2×2 grid with `+` separator)** | `gap-px` + `bg-[#21262d]` parent + `bg-[#0a0e13]` cells creates clean separator lines. See landing page MetaStat pattern. |
| **Pillar/Row stack** | `flex flex-col md:grid md:grid-cols-[NN_1fr_auto]` — vertical stack on mobile, 3-col grid on desktop. Avoids the awkward "tag indented under number" issue. |

### 6. App header pattern (if predictions has authenticated chrome)

Atlas's `AppHeader` (in `shared/app-header.tsx`) collapses nav into a sheet below `md`, keeps wallet/status pills above. Predictions likely has different chrome needs (e.g., active market selector instead of wallet) but the **collapse pattern** is portable: visible nav at md+, hamburger trigger + slide-in sheet at <md.

### 7. Marketing chrome (if predictions has marketing pages)

Atlas marketing pages: `/`, `/institutions`, `/regulation`, `/faq`, `/signup`. All share `MarketingNav` + `MarketingFooter`. Same chrome pattern works for predictions if/when it grows a marketing surface.

---

## What NOT to port

- **KYC gate** (`auth/`, `lib/kyc.ts`, `signup/`) — predictions doesn't have an authenticated user model that needs gating
- **Pinata IPFS proxy** (`api/ipfs/*`, `lib/pinata.ts`) — no user uploads
- **Upstash mint registry** (`api/mints/*`, `lib/registry.ts`) — different data model
- **Solana wallet adapter wiring** — predictions may have its own blockchain layer (or none)
- **Token-2022 service layer** (`lib/solana/*`) — Atlas-specific
- **CipheX Atlas-specific copy** (anything mentioning Token-2022, RWA, custodial wallets, etc.)
- **The Polaris Crosshair mark itself** — Atlas owns this. Predictions needs its own.

---

## Reference files in Atlas (paths from repo root)

For the agent doing the port, these are the canonical files to study:

| File | Why |
|---|---|
| `cipherion-tokenize/src/app/layout.tsx` | Font loading (Geist + Geist Mono via next/font) — already aligned with predictions |
| `cipherion-tokenize/src/app/globals.css` | iOS zoom rule, base layer |
| `cipherion-tokenize/src/app/icon.svg` | Polaris favicon (reference for predictions' mark format) |
| `cipherion-tokenize/src/app/apple-icon.svg` | iOS app icon at 180×180 |
| `cipherion-tokenize/src/components/shared/atlas-logo.tsx` | AtlasLogo + AtlasWordmark — adapt for predictions |
| `cipherion-tokenize/src/components/shared/page-header.tsx` | Direct port |
| `cipherion-tokenize/src/components/shared/app-shell.tsx` | Marketing-route hide-chrome pattern |
| `cipherion-tokenize/src/components/shared/app-header.tsx` | Mobile sheet collapse with KycPill/NetworkBadge in sheet |
| `cipherion-tokenize/src/components/landing/marketing-chrome.tsx` | MarketingNav + MarketingFooter, mobile sheet |
| `cipherion-tokenize/src/components/landing/landing-page.tsx` | Hero + meta-stats + pillar patterns. Especially the meta-stats `+`-separator 2×2 grid and the Pillar component (flex-col mobile / grid desktop). |
| `cipherion-tokenize/src/components/landing/institutions-page.tsx` | Row component (icon + title + tag stack pattern), CostCard (mobile-stack table) |
| `cipherion-tokenize/src/components/landing/regulation-page.tsx` | Table-to-card-stack pattern for data tables on mobile |
| `cipherion-tokenize/src/components/holders/cap-table.tsx` | Reference for table-to-cards on mobile |
| `cipherion-tokenize/src/components/history/transaction-list.tsx` | Stack-on-mobile row pattern |
| `plans/ATLAS_HANDOFF.md` | Full design-system summary in one document |

---

## Recommended phasing for predictions

1. **Phase A — Foundation (1–2 days)**
   - Bump canvas to `#0a0e13`
   - Create `AbacusLogo` + `AbacusWordmark` components (placeholder mark or designed mark — confirm with user first)
   - Port `PageHeader` to predictions' shared components
   - Add iOS zoom rule to `globals.css`

2. **Phase B — Audit + replace ad-hoc page headers (1–2 days)**
   - Inventory predictions' pages, identify where ad-hoc h1/h2 patterns exist
   - Replace with PageHeader where they fit
   - Apply responsive typography sizes globally

3. **Phase C — Mobile chrome (1–2 days)**
   - If predictions has a top nav: implement the hamburger sheet pattern
   - Apply tabs overflow-scroll to any TabsList components
   - Apply table-to-card-stack to data-dense screens

4. **Phase D — Component parity (variable)**
   - Status pills, accent tints, button variants — align with Atlas tokens
   - Form inputs: bump to 16px on mobile (already covered by global rule if added)

5. **Phase E — Marketing surface (optional, only if predictions wants one)**
   - Port MarketingNav + MarketingFooter pattern
   - Build landing/institutions/regulation/etc. pages if needed

---

## Anti-patterns / what to avoid

- **Don't copy the Polaris Crosshair logo.** Atlas owns it. Predictions needs its own glyph.
- **Don't introduce a serif display font.** Atlas tried Libre Caslon and rolled back to all-Geist for institutional cleanliness. Stay all-sans.
- **Don't copy KYC/RequireKyc/KycPill.** Predictions doesn't gate on KYC.
- **Don't break predictions' real-time data UX** to fit Atlas's editorial layout. Predictions is data-dense by nature; preserve density where it serves users.
- **Don't claim "design system parity" before actually shipping it.** Same discipline as the Atlas multi-chain claim — don't market what you haven't built.

---

## Verification before shipping

- Both repos open side-by-side at the same routes (or equivalent)
- Visual diff: type system, canvas color, primary CTA, status pills, page header look the same family
- Mobile (375px) on both: nav collapses to hamburger, tables stack to cards, no horizontal overflow
- Inputs on iOS: no zoom-in on focus
- Brand mark: Abacus has its own glyph (not Polaris)
- Wordmark suffix: "ABACUS by CIPHEX" in same style as "ATLAS by CIPHEX"

---

## Open question for the user before starting

**Mark design for Abacus.** Atlas got the Polaris Crosshair via the Atlas design system project. Does predictions:
- (a) Use a placeholder wordmark-only treatment until a real mark is commissioned?
- (b) Get 2–3 new mark concepts proposed in the same visual family (geometric, dark backdrop, green accent)?
- (c) Get a quick functional mark (e.g., abacus-bead or candlestick motif) shipped now and refined later?

Surface this question to the user in the predictions chat before any logo work.

---

## When this work is done

Update `plans/ATLAS_HANDOFF.md` to note "Both Atlas and Abacus now ship the same design system" (or whatever the final state is). Add an `ABACUS_HANDOFF.md` mirror of the current ATLAS_HANDOFF for predictions if the changes warrant it.
