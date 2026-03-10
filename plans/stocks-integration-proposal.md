# Stocks Integration Proposal: Abacus AMS Dashboard

**Date:** March 5, 2026
**Status:** Draft
**Scope:** Frontend integration of 18 US equity/ETF assets + asset selector UX redesign

---

## 1. Executive Summary

The backend stock forecasting system is deployed and live. The Ciphex API returns stock predictions via the same `/v2/assets/{id}/dashboard/hybrid` endpoint used by crypto, with structural differences: 2 blocks instead of 3, ~6.5h cycles (9:30 AM - 4:00 PM ET) instead of 24h, and a wider signal vocabulary. A new `/v1/market/status` endpoint provides real-time US equity market state.

The frontend codebase was designed with stock support in mind -- asset types, price routing, and SSE streaming are already wired behind `ENABLE_STOCKS = false`. The primary work is: widening the type system, redesigning the asset selector for 29+ items across two asset classes, adding market status awareness, and adapting cycle-specific display logic.

**Estimated scope:** ~15 modified files, ~4 new files, zero new API routes to the backend needed.

---

## 2. Architecture Overview

### Current Data Flow (Crypto)
```
Binance WS --> usePriceData --> candles[] --> PriceChart
Ciphex API --> usePredictions --> PredictionData --> Sidebar + Chart bands
```

### Stock Data Flow (Already Wired)
```
Databento SSE --> usePriceData (assetType='stock') --> candles[] --> PriceChart
Ciphex API --> usePredictions (same endpoint) --> PredictionData --> Sidebar + Chart bands
```

### What Gets Added
```
NEW: /v1/market/status --> useMarketStatus --> Header badge + CycleProgress label
NEW: AssetSelector component (replaces flat Select dropdown)
```

The prediction pipeline (`usePredictions` -> `/api/predictions/[assetId]` -> `ciphex.ts:transformDashboardResponse`) is fully asset-agnostic. The transform already iterates blocks dynamically and reads `block.block_type` for labels. The gaps are in the type definitions, presentation layer, and UX scalability.

---

## 3. Verified API Behavior (Live Calls)

### GET /v1/assets
Returns all assets with `asset_type: "CEX" | "STOCK" | "DEX"`. Stock assets have `quote: "USD"`, `exchange: null`. All 18 stock UUIDs in our config match the registry.

### GET /v1/market/status
```json
{
  "status": "OPEN",
  "is_trading": true,
  "current_time_et": "13:52:44 ET",
  "session_open_utc": "2026-03-05T13:30:00Z",
  "session_close_utc": "2026-03-05T20:00:00Z",
  "next_open_utc": null,
  "last_close_utc": "2026-03-04T20:00:00Z",
  "is_holiday": false,
  "holiday_name": null
}
```

### GET /v2/assets/{id}/dashboard/hybrid (AAPL, TSLA, SPY verified)
- `asset.market_type: "STOCK"`, `asset.exchange: null`
- 2 blocks (outlook + continuation), 5 horizons each = 10 total
- Signals include: `"Ideal"`, `"Favorable"`, `"Down"`, `"Up"`, `"Unknown"`
- `hybrid_metadata.asset_type: "STOCK"`, `tts_eligible: true`
- Block 2's last `horizon_end_ts` is always `21:00 UTC` (16:00 ET = market close)
- `market_state` object present with volume/volatility/momentum data

### Key Structural Differences: STOCK vs CEX

| Field | STOCK | CEX |
|-------|-------|-----|
| `asset.market_type` | `"STOCK"` | `"CEX"` |
| `asset.exchange` | `null` | `"binance"` |
| Blocks | 2 (outlook, continuation) | 3 (+ persistence) |
| Total horizons | 10 | 15 |
| Block 2 interval | ~27 min (dynamic) | 2h 24min (fixed) |
| Last horizon | 16:00 ET (market close) | ~next day baseline |
| Cycle duration | ~6.5h (trading day) | ~24h |

---

## 4. What Already Works (No Changes Needed)

| Component | Why It's Safe |
|-----------|---------------|
| `ciphex.ts:transformDashboardResponse` | Iterates `dashboard.blocks` dynamically, not hardcoded to 3 |
| `usePredictions.ts` | Generic, passes asset ID through |
| `usePriceData.ts` | Routes `stock` type to `/api/prices/stock/` + SSE streaming |
| `/api/predictions/[assetId]/route.ts` | Generic proxy |
| `/api/prices/stock/[symbol]/route.ts` | Already exists |
| `/api/prices/stock/[symbol]/stream/route.ts` | Already exists |
| Exchange WebSocket hooks | Gated behind `isCrypto` in `page.tsx:114` |
| Abacus:INDEX hooks | Gated behind `abacusAssetId` null check (`page.tsx:61-67`) |
| Data source toggle | Gated: `selectedAsset?.type === 'crypto'` (`Header.tsx:265`) |
| Chart prediction bands | Iterates `blocks` array dynamically in `PriceChart.tsx` |
| Settlement mapping | `transformDashboardResponse` maps by `block_number:horizon_index` |

---

## 5. Detailed Implementation Plan

### Phase 1: Type System + Data Layer (Day 1)

#### 5.1 Widen Signal Type Union

**File:** `src/types/predictions.ts`

```ts
// Line 3 - Current:
signal: 'Favorable' | 'Ideal' | 'Certain';

// Change to:
signal: 'Favorable' | 'Ideal' | 'Certain' | 'Up' | 'Down' | 'Unknown' | 'Neutral';
```

Apply same change to `HorizonMarkerModel` at line 89.

#### 5.2 Add `assetType` to PredictionData

**File:** `src/types/predictions.ts`

```ts
export interface PredictionData {
  blocks: Block[];
  cycle: CycleInfo;
  allPredictions: Horizon[];
  hybridMetadata?: HybridMetadata;
  assetType?: 'CEX' | 'STOCK' | 'DEX';  // NEW
}
```

#### 5.3 Propagate `assetType` Through Transform

**File:** `src/lib/api/ciphex.ts`

In `transformDashboardResponse`, add to the return:
```ts
return {
  blocks, cycle, allPredictions, hybridMetadata,
  assetType: dashboard.asset?.market_type || dashboard.hybrid_metadata?.asset_type || null,
};
```

#### 5.4 Capitalize Block Labels in Transform

**File:** `src/lib/api/ciphex.ts`, line 80

```ts
// Current:
label: block.block_type || `Block ${block.block_number}`,

// Change to (capitalize first letter):
label: block.block_type
  ? block.block_type.charAt(0).toUpperCase() + block.block_type.slice(1)
  : `Block ${block.block_number}`,
```

---

### Phase 2: Market Status (Day 1-2)

#### 5.5 New API Route

**New file:** `src/app/api/market/status/route.ts`

Proxy to `CIPHEX_API_URL/v1/market/status` with API key. Cache with `revalidate: 30`.

#### 5.6 New Hook: `useMarketStatus`

**New file:** `src/hooks/useMarketStatus.ts`

```ts
interface MarketStatus {
  status: 'OPEN' | 'CLOSED' | 'PRE_OPEN' | 'POST_CLOSE';
  isTrading: boolean;
  currentTimeET: string;
  sessionCloseUTC: string | null;
  nextOpenUTC: string | null;
  isHoliday: boolean;
  holidayName: string | null;
}

function useMarketStatus(options: { enabled: boolean }): {
  marketStatus: MarketStatus | null;
  loading: boolean;
}
```

Poll every 60 seconds when `enabled` is true. Only active when a stock asset is selected.

---

### Phase 3: Asset Selector Redesign (Day 2-3)

This is the core UX work. The current flat `<Select>` dropdown holds 11 crypto items. Adding 18 stocks makes 29 items -- too many for a single dropdown.

#### 5.7 New Component: `AssetSelector`

**New file:** `src/components/header/AssetSelector.tsx`

A **Popover** (not Select) with tabbed navigation, search, and sub-grouping.

**Desktop Layout:**

```
Trigger (closed):
+----------------------------+
| * AAPL - Apple           v |    * = colored dot (green=stock, blue=crypto)
+----------------------------+

Popover (open, Stocks tab active):
+--------------------------------+
| +----------------------------+ |
| | Search assets...           | |    bg-[#161b22], 12px text
| +----------------------------+ |
|                                |
| +----------+ +----------+     |
| |  Crypto  | | *Stocks* |     |    Active: bg-[#30363d] text-[#f0f6fc]
| +----------+ +----------+     |    Inactive: text-[#8b949e]
|                                |
| -- Individual Stocks --------- |    text-[10px] text-[#484f58]
|                                |
| | AAPL    Apple         <--- | |    Selected: border-l-2 border-[#238636]
|   AMZN    Amazon              |
|   NVDA    NVIDIA              |    Symbol: mono, bold, #f0f6fc
|   TSLA    Tesla               |    Name: #8b949e
|   META    Meta                |
|   MSFT    Microsoft           |    Hover: bg-[#30363d]
|   GOOGL   Alphabet A          |
|   GOOG    Alphabet C          |
|                                |
| -- ETFs --------------------- |
|                                |
|   SPY     S&P 500 ETF         |
|   QQQ     Nasdaq ETF          |
|   DIA     Dow Jones ETF       |
|   IWM     Russell 2000 ETF    |
|   XLK     Technology          |
|   XLF     Financial           |
|   XLE     Energy              |
|   XLI     Industrial          |
|   XLP     Consumer Staples    |
|   XLV     Health Care         |
|                                |
| +----------------------------+ |
| | * Market Open              | |    Footer: market status (stocks tab only)
| |   Closes 4:00 PM ET       | |    bg-[#161b22], green/red dot
| +----------------------------+ |
+--------------------------------+
```

**Specifications:**
- Width: 280px. Max height: 400px with internal scroll
- Tab state persisted in `localStorage` (remembers last active tab across sessions)
- Search filters by symbol or displayName across both tabs
- Keyboard: Arrow keys navigate, Enter selects, Escape closes, typing focuses search
- Animation: `fade-in-0 zoom-in-95` on open (Radix Popover primitives)
- Radix `Popover` from existing `@radix-ui/react-popover` dep

**Props:**
```ts
interface AssetSelectorProps {
  selectedAsset: Asset | null;
  onAssetChange: (assetId: string) => void;
  marketStatus?: MarketStatus | null;
}
```

#### 5.8 Stock Sub-Group Config

**File:** `src/config/assets.ts`

Add sub-group metadata for the Stocks tab:

```ts
export const STOCK_SUB_GROUPS = [
  {
    label: 'Individual Stocks',
    symbols: ['AAPL', 'AMZN', 'NVDA', 'TSLA', 'META', 'MSFT', 'GOOGL', 'GOOG'],
  },
  {
    label: 'ETFs',
    symbols: ['SPY', 'QQQ', 'DIA', 'IWM', 'XLK', 'XLF', 'XLE', 'XLI', 'XLP', 'XLV'],
  },
];
```

#### 5.9 Mobile Asset Selector

**File:** `src/components/mobile/MobileMenu.tsx`

Replace flat grid with tabbed view:

```
+---------------------------------+
| Settings                      X |
+---------------------------------+
|                                 |
| Interval                        |
| [15s] [1m] [15m] [1h]          |
|                                 |
| Asset                           |
| +-----------+ +-----------+    |
| |  Crypto   | |  Stocks   |    |    Tab pills
| +-----------+ +-----------+    |
|                                 |
| -- Individual Stocks ---------- |
| +------+ +------+              |
| | AAPL | | AMZN |              |    2-col grid per tab
| +------+ +------+              |
| | NVDA | | TSLA |              |
| +------+ +------+              |
| ...                             |
|                                 |
| -- ETFs ---------------------- |
| +------+ +------+              |
| | SPY  | | QQQ  |              |
| +------+ +------+              |
| ...                             |
|                                 |
| * Market Open - Closes 4:00 ET |    Status banner (stocks tab only)
|                                 |
| [        Refresh Data         ] |
+---------------------------------+
```

---

### Phase 4: Sidebar & Block Adaptations (Day 3-4)

#### 5.10 HorizonsList: Use Dynamic Block Labels

**File:** `src/components/sidebar/HorizonsList.tsx`

Line 13: Remove the `BLOCK_NAMES` constant entirely.

Change line 94 from:
```tsx
Block {blockIdx + 1}: {BLOCK_NAMES[blockIdx + 1]}
```
To:
```tsx
Block {blockIdx + 1}: {block.label}
```

The `block.label` is already set by `transformDashboardResponse` from `block_type`. This makes the component fully dynamic for any number of blocks.

#### 5.11 CycleProgress: Dynamic Segments and Labels

**File:** `src/components/sidebar/CycleProgress.tsx`

Changes needed:
1. Accept `predictions` (or `assetType`) prop to determine context
2. Render block labels dynamically based on `blocks.length`:
   - 2 blocks: "Outlook" and "Continuation" (evenly spaced)
   - 3 blocks: "Outlook", "Continuation", "Persistence"
3. Change cycle label from hardcoded `"24H Remaining Cycle"` to:
   - Stock: `"Trading Day"`
   - Crypto: `"24H Cycle"`
4. When all horizons settled and market closed: show `"Session Complete"`

#### 5.12 Signal-Aware Badge Colors

**New file:** `src/lib/utils/signal-colors.ts`

```ts
export const SIGNAL_STYLES: Record<string, { bg: string; text: string }> = {
  Favorable: { bg: 'bg-[#238636]', text: 'text-white' },
  Ideal:     { bg: 'bg-[#238636]', text: 'text-white' },
  Certain:   { bg: 'bg-[#238636]', text: 'text-white' },
  Up:        { bg: 'bg-[rgba(63,185,80,0.15)]', text: 'text-[#3fb950]' },
  Down:      { bg: 'bg-[rgba(248,81,73,0.15)]', text: 'text-[#f85149]' },
  Neutral:   { bg: 'bg-[rgba(139,148,158,0.15)]', text: 'text-[#8b949e]' },
  Unknown:   { bg: 'bg-[rgba(210,153,34,0.15)]', text: 'text-[#d29922]' },
};
```

Apply in `PredictionCard.tsx` (line 25 badge) and `HorizonMarkers.tsx` (marker tooltips).

---

### Phase 5: Header Market Status (Day 4)

#### 5.13 Market Status Badge in Header

**File:** `src/components/header/Header.tsx`

When `selectedAsset?.type === 'stock'`, display next to the Live/Offline badge:

```
[Live] [* Market Open - Closes 4:00 PM ET]
```

Status colors:
- `OPEN`: Green dot, `"Market Open"`
- `CLOSED`: Red dot, `"Market Closed"`
- `PRE_OPEN`: Yellow dot, `"Pre-Market"`
- `POST_CLOSE`: Yellow dot, `"After Hours"`

When market is closed + stock selected, replace "Offline" with "Market Closed" to avoid confusion (SSE stream has no data but that's expected).

---

### Phase 6: Page-Level Wiring (Day 4-5)

#### 5.14 page.tsx Integration

**File:** `src/app/page.tsx`

1. Import and wire `useMarketStatus`:
```ts
const { marketStatus } = useMarketStatus({
  enabled: selectedAsset?.type === 'stock'
});
```

2. Replace `<Select>` with `<AssetSelector>` in Header props (or Header uses it internally)

3. Pass `marketStatus` to Header

4. Pass `assetType` / `blocks` to `SidebarContent` -> `CycleProgress`

#### 5.15 Flip Feature Flag

**File:** `src/config/assets.ts`, line 232

```ts
const ENABLE_STOCKS = true;
```

This is the final gate. Done last after all other changes are verified.

---

## 6. New Files Summary

| File | Type | Purpose |
|------|------|---------|
| `src/components/header/AssetSelector.tsx` | Component | Tabbed popover asset picker with search |
| `src/hooks/useMarketStatus.ts` | Hook | Poll `/v1/market/status` for equity market state |
| `src/app/api/market/status/route.ts` | API Route | Proxy to Ciphex market status endpoint |
| `src/lib/utils/signal-colors.ts` | Utility | Shared signal-to-color mapping for badges |

---

## 7. Modified Files Summary

| File | Change |
|------|--------|
| `src/types/predictions.ts` | Widen signal union, add `assetType` to `PredictionData` |
| `src/lib/api/ciphex.ts` | Return `assetType`, capitalize `block_type` label |
| `src/config/assets.ts` | Add `STOCK_SUB_GROUPS`, flip `ENABLE_STOCKS` |
| `src/components/header/Header.tsx` | Replace Select with AssetSelector, add market status badge |
| `src/components/mobile/MobileMenu.tsx` | Tabbed asset view with sub-groups |
| `src/components/sidebar/HorizonsList.tsx` | Use `block.label` instead of positional array |
| `src/components/sidebar/CycleProgress.tsx` | Dynamic block labels, cycle type label |
| `src/components/sidebar/PredictionCard.tsx` | Signal-aware badge colors |
| `src/components/chart/HorizonMarkers.tsx` | Signal-aware marker colors |
| `src/app/page.tsx` | Wire useMarketStatus, pass new props |
| `src/hooks/index.ts` | Export useMarketStatus |
| `src/lib/chart-constants.ts` | No critical changes (block arrays safe for 2-index access) |

---

## 8. Edge Cases & Considerations

### 8.1 Market Closed State
- **Weekend/Holiday:** `useMarketStatus` returns `isTrading: false`. SSE produces no data. Chart shows last session's data. CycleProgress shows "Session Complete" with `nextOpenUTC` countdown.
- **Holiday with name:** Badge shows: "Market Closed - Good Friday"
- **Pre/After hours:** Show distinct badge. No price streaming during these periods.

### 8.2 Timezone Handling
- All internal timestamps remain UTC (Unix seconds), consistent with crypto.
- Stock horizon times display in user's local timezone (via `toLocaleTimeString()`). Since horizons carry absolute UTC timestamps, this is correct for any timezone.
- The market status badge shows ET explicitly: "Closes 4:00 PM ET".

### 8.3 Cycle Timing
- Stock cycles: ~6.5h, 2 blocks x 5 horizons = 10 total.
- Crypto cycles: ~24h, 3 blocks x 5 horizons = 15 total.
- `CycleProgress` segments are `flex-1`, so 10 vs 15 auto-sizes correctly.
- Block 2's last horizon always aligns to 16:00 ET. `remaining_minutes` handles countdown.

### 8.4 Dynamic Horizon Intervals
- Stock Block 2 horizons are ~27 min apart (dynamic, not fixed). Chart band rendering reads each horizon's timestamp directly -- no hardcoded interval assumption.

### 8.5 Price Formatting
- Stock prices are USD (not USDT). `formatPrice` already formats to 2 decimal places.

### 8.6 Switching Between Asset Classes
- Crypto -> Stock: Predictions refresh, chart resets, exchange overlays disappear (gated by `isCrypto`), data source toggle hides, market status badge appears.
- Stock -> Crypto: Reverse of above. Abacus toggle reappears for BTC/ETH.
- All handled by existing gating logic in `page.tsx`.

### 8.7 Historical Bands
- `useHistoricalBands` and `transformHistoryResponse` are asset-agnostic. Stock data renders with 2 blocks per cycle. No changes needed.

---

## 9. Testing Strategy

### Type System
- [ ] TypeScript compiles cleanly after signal union widening
- [ ] Existing crypto predictions still load and display correctly
- [ ] AAPL, TSLA, SPY dashboard responses parse without errors

### Market Status
- [ ] Hook returns correct status during market hours
- [ ] Hook returns correct status during off-hours/weekends
- [ ] Polling stops when switching to crypto asset
- [ ] Badge displays correct state and color

### Asset Selector
- [ ] Desktop popover opens/closes correctly
- [ ] Tab switching works; last tab persisted in localStorage
- [ ] Search filters by symbol and displayName
- [ ] Keyboard navigation (arrows, Enter, Escape)
- [ ] Selected asset highlighted
- [ ] Mobile tabs render correctly
- [ ] Selecting stock triggers correct data load

### Stock Predictions Display
- [ ] CycleProgress shows 10 segments for stocks
- [ ] CycleProgress shows "Trading Day" label for stocks
- [ ] HorizonsList shows 2 blocks with dynamic labels
- [ ] PredictionCard displays stock signals with correct colors
- [ ] Chart renders 2-block prediction bands (blue + purple)

### Cross-Asset Switching
- [ ] Crypto -> Stock: exchange overlays disappear, data source toggle hides
- [ ] Stock -> Crypto: overlays reappear, toggle returns for BTC/ETH
- [ ] No stale data shown during transitions

### Market Closed Behavior
- [ ] Header shows "Market Closed" not "Offline"
- [ ] CycleProgress shows "Session Complete" when all settled
- [ ] Chart displays last session data gracefully

---

## 10. Migration Path

### Step 1: Safe Backend Changes
Merge Phase 1-2 (types, market status hook, signal colors) behind existing feature flag. Zero impact on crypto users.

### Step 2: UX Components
Merge `AssetSelector` component. It replaces the `<Select>` but initially only shows Crypto tab (stocks still flagged off). Validate crypto UX isn't degraded.

### Step 3: Feature Flag Flip
Single commit: `ENABLE_STOCKS = true`. Stocks tab appears, all sidebar/chart adaptations activate.

### Step 4: Optional Environment Variable
Replace boolean flag with:
```ts
const ENABLE_STOCKS = process.env.NEXT_PUBLIC_ENABLE_STOCKS === 'true';
```
Enables per-environment rollout (staging first, then production).

---

## 11. Priority Matrix

| Priority | Phase | Work Item | Depends On | Effort |
|----------|-------|-----------|------------|--------|
| P0 | 1 | Widen signal types + add assetType | None | Small |
| P0 | 3 | Build AssetSelector component | None | Large |
| P0 | 3 | Update MobileMenu with tabs | None | Medium |
| P1 | 2 | Market status hook + API route | None | Small |
| P1 | 4 | HorizonsList dynamic labels | Phase 1 | Small |
| P1 | 4 | CycleProgress dynamic adaptation | Phase 1 | Medium |
| P1 | 4 | Signal color mapping + apply | Phase 1 | Small |
| P2 | 5 | Market status badge in header | Phase 2 | Small |
| P2 | 6 | page.tsx wiring | All above | Medium |
| P3 | 6 | Flip feature flag | All above | Trivial |
