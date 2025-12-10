# Ciphex Predictions Web Application - Architecture Specification

**Version:** 1.0
**Date:** 2025-12-09
**Status:** Approved for Development

---

## Executive Summary

A real-time web application that visualizes Ciphex price predictions overlaid on live market data. The application displays prediction bands (high/mid/low) similar to Bollinger Bands, with clear cycle progress tracking across a 24-hour forecast window.

### Supported Assets
- **11 Crypto** (via Binance): BTC, ETH, SOL, BNB, XRP, ADA, DOT, ATOM, TON, TRX, ZEC
- **2 DEX Tokens** (via Binance/DEX): TRUMP, FARTCOIN
- **18 Stocks/ETFs** (via Databento): AAPL, AMZN, NVDA, TSLA, META, MSFT, GOOGL, GOOG, SPY, QQQ, DIA, IWM, XLK, XLF, XLE, XLI, XLP, XLV

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Framework** | Next.js 14 (App Router) | API routes solve CORS, server components, Vercel-optimized |
| **Language** | TypeScript | Type safety, better DX, fewer runtime errors |
| **Styling** | TailwindCSS | Utility-first, rapid iteration, dark mode support |
| **Components** | shadcn/ui | Accessible, customizable, professional appearance |
| **Charts** | Lightweight Charts v4 | TradingView's library, proven in POC, performant |
| **Real-time** | WebSocket + Polling | Live prices (WS), predictions (polling) |
| **Auth** | NextAuth.js | Flexible, supports OAuth + credentials |
| **Database** | PostgreSQL (Supabase) | User data, watchlists, preferences |
| **Deployment** | Vercel | Zero-config Next.js, edge network, serverless |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                 CLIENT                                       │
│                          (Next.js Frontend)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│   │   Chart     │  │  Sidebar    │  │   Header    │  │   Modals    │       │
│   │  Component  │  │  Component  │  │  Component  │  │             │       │
│   └──────┬──────┘  └──────┬──────┘  └─────────────┘  └─────────────┘       │
│          │                │                                                  │
│          ▼                ▼                                                  │
│   ┌─────────────────────────────────────────────────────────────────┐       │
│   │                     React Hooks Layer                            │       │
│   │  usePredictions() │ usePriceData() │ useWebSocket() │ useAuth() │       │
│   └─────────────────────────────────────────────────────────────────┘       │
│                                    │                                         │
└────────────────────────────────────┼─────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                       │
│                        (Next.js API Routes)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   /api/predictions/[assetId]    →  Ciphex API proxy                         │
│   /api/assets                   →  Ciphex assets list                       │
│   /api/prices/crypto/[symbol]   →  Binance REST proxy                       │
│   /api/prices/stock/[symbol]    →  Databento REST proxy                     │
│   /api/auth/[...nextauth]       →  Authentication                           │
│   /api/user/watchlist           →  User watchlist CRUD                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SERVICES                                   │
├────────────────┬────────────────┬────────────────┬──────────────────────────┤
│                │                │                │                          │
│  Ciphex API    │  Binance API   │  Databento     │  Supabase               │
│                │                │                │                          │
│  Predictions   │  Crypto Prices │  Stock Prices  │  PostgreSQL DB          │
│  Asset Config  │  WebSocket     │  WebSocket     │  Auth Storage           │
│                │                │                │                          │
└────────────────┴────────────────┴────────────────┴──────────────────────────┘
```

---

## Data Flow

### Price Data (Real-time)

```
CRYPTO:
Binance WebSocket ──────────────────────────────▶ Browser
(wss://stream.binance.com)                        (direct connection)

STOCKS:
Databento ─────▶ Next.js Server ─────▶ Browser
(WebSocket)      (proxy/transform)     (Server-Sent Events)
```

### Prediction Data (Polling)

```
Browser ────────▶ Next.js API ────────▶ Ciphex API
        (every 5 min)        (proxy)    /v2/assets/{id}/dashboard
```

### Data Refresh Strategy

| Data Type | Method | Frequency | Rationale |
|-----------|--------|-----------|-----------|
| Crypto Prices | WebSocket | Real-time | Binance provides free WS |
| Stock Prices | WebSocket/Polling | Real-time/15s | Databento connection |
| Predictions | Polling | 5 minutes | Reforecasts every 5-45 min |
| Assets List | On-demand | On page load | Rarely changes |

---

## Directory Structure

```
ciphex-predictions/
├── app/                              # Next.js App Router
│   ├── (auth)/                       # Auth route group
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/                  # Main app route group
│   │   ├── page.tsx                  # Dashboard home
│   │   ├── asset/[symbol]/page.tsx   # Single asset view
│   │   ├── watchlist/page.tsx        # User watchlist
│   │   └── layout.tsx                # Dashboard layout
│   ├── api/                          # API routes
│   │   ├── predictions/
│   │   │   └── [assetId]/route.ts
│   │   ├── assets/route.ts
│   │   ├── prices/
│   │   │   ├── crypto/[symbol]/route.ts
│   │   │   └── stock/[symbol]/route.ts
│   │   ├── auth/[...nextauth]/route.ts
│   │   └── user/
│   │       └── watchlist/route.ts
│   ├── layout.tsx                    # Root layout
│   ├── globals.css                   # Global styles
│   └── providers.tsx                 # Context providers
│
├── components/
│   ├── ui/                           # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── select.tsx
│   │   ├── card.tsx
│   │   └── ...
│   ├── chart/
│   │   ├── PriceChart.tsx            # Main chart component
│   │   ├── PredictionBands.tsx       # Prediction overlay logic
│   │   ├── ChartLegend.tsx
│   │   └── ChartControls.tsx
│   ├── sidebar/
│   │   ├── Sidebar.tsx
│   │   ├── CycleProgress.tsx         # 15-segment progress bar
│   │   ├── PredictionCard.tsx        # Current/next prediction
│   │   └── HorizonsList.tsx          # All horizons list
│   ├── header/
│   │   ├── Header.tsx
│   │   ├── AssetSelector.tsx
│   │   └── TimeframeSelector.tsx
│   └── common/
│       ├── Loading.tsx
│       └── Error.tsx
│
├── lib/
│   ├── api/
│   │   ├── ciphex.ts                 # Ciphex API client
│   │   ├── binance.ts                # Binance API client
│   │   └── databento.ts              # Databento client
│   ├── utils/
│   │   ├── formatters.ts             # Price/date formatting
│   │   ├── transforms.ts             # Data transformations
│   │   └── constants.ts              # App constants
│   └── db/
│       └── supabase.ts               # Database client
│
├── hooks/
│   ├── usePredictions.ts             # Fetch/cache predictions
│   ├── usePriceData.ts               # Fetch price candles
│   ├── useWebSocket.ts               # WebSocket management
│   ├── useAssets.ts                  # Asset list management
│   └── useWatchlist.ts               # User watchlist
│
├── types/
│   ├── predictions.ts                # Prediction types
│   ├── assets.ts                     # Asset types
│   ├── prices.ts                     # Price data types
│   └── api.ts                        # API response types
│
├── config/
│   ├── assets.ts                     # Asset UUID mappings
│   └── site.ts                       # Site configuration
│
├── public/
│   └── favicon.ico
│
├── .env.local                        # Local environment
├── .env.example                      # Environment template
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## Core Components

### 1. PriceChart

The main chart component using Lightweight Charts.

**Responsibilities:**
- Render candlestick series (price data)
- Render prediction band lines (high/mid/low)
- Handle zoom/pan interactions
- Respond to symbol/timeframe changes

**Props:**
```typescript
interface PriceChartProps {
  symbol: string;
  assetType: 'crypto' | 'stock' | 'dex';
  interval: '15m' | '1h' | '4h';
  predictions: Prediction[];
}
```

### 2. CycleProgress

Visual progress indicator for the 24-hour prediction cycle.

**Features:**
- 15 segments (one per horizon)
- Color coding: green (settled), yellow (current), gray (pending)
- Block labels (Outlook, Continuation, Persistence)
- Live countdown to cycle reset

### 3. PredictionCard

Displays details for the current/next prediction.

**Data Shown:**
- High/Mid/Low prices
- Probability score
- Signal (Favorable, Certain, etc.)
- Direction (Up, Down, Neutral)
- Time until horizon

### 4. AssetSelector

Dropdown for switching between assets.

**Features:**
- Grouped by type (Crypto, Stocks, DEX)
- Search/filter
- Recent assets
- Watchlist quick access

---

## API Endpoints

### Internal API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/assets` | GET | List all supported assets |
| `/api/predictions/[assetId]` | GET | Get predictions for asset |
| `/api/prices/crypto/[symbol]` | GET | Get crypto price data |
| `/api/prices/stock/[symbol]` | GET | Get stock price data |
| `/api/user/watchlist` | GET, POST, DELETE | Manage watchlist |

### External API Integration

#### Ciphex API
```
Base URL: https://api.ciphex.io
Auth: X-API-Key header

GET /v1/assets              → Asset list
GET /v2/assets/{id}/dashboard → Predictions + market state
```

#### Binance API
```
Base URL: https://api.binance.com/api/v3
Auth: None (public endpoints)

GET /klines?symbol={}&interval={}&limit={} → Historical candles
WSS wss://stream.binance.com:9443/ws/{symbol}@kline_{interval} → Real-time
```

#### Databento API
```
Auth: API Key required
Protocol: REST + WebSocket
```

---

## State Management

Using React hooks + context for simplicity (no Redux needed).

### Global State (Context)
- Current asset selection
- User authentication state
- Theme preference

### Local State (Hooks)
- Price data (per chart)
- Predictions (per asset)
- WebSocket connections

### Caching Strategy
- Predictions: Cache for 5 minutes (SWR/React Query)
- Price data: No cache (real-time)
- Asset list: Cache for 1 hour

---

## Authentication

### NextAuth.js Configuration

**Providers:**
1. Email/Password (credentials)
2. Google OAuth (optional)
3. GitHub OAuth (optional)

**Session Strategy:** JWT (stateless)

**Protected Routes:**
- `/watchlist` - requires auth
- `/settings` - requires auth
- `/api/user/*` - requires auth

**Public Routes:**
- `/` - dashboard (works without auth)
- `/asset/[symbol]` - single asset view

---

## Database Schema

### Tables (Supabase/PostgreSQL)

```sql
-- Users (managed by NextAuth)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  image TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Watchlists
CREATE TABLE watchlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL,  -- Ciphex UUID
  symbol TEXT NOT NULL,
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, asset_id)
);

-- User Preferences
CREATE TABLE preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  default_interval TEXT DEFAULT '1h',
  theme TEXT DEFAULT 'dark',
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Deployment

### Vercel Configuration

```json
// vercel.json
{
  "framework": "nextjs",
  "regions": ["iad1"],
  "env": {
    "CIPHEX_API_URL": "@ciphex-api-url",
    "CIPHEX_API_KEY": "@ciphex-api-key",
    "DATABENTO_API_KEY": "@databento-api-key",
    "DATABASE_URL": "@database-url",
    "NEXTAUTH_SECRET": "@nextauth-secret",
    "NEXTAUTH_URL": "@nextauth-url"
  }
}
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `CIPHEX_API_URL` | Ciphex API base URL | Yes |
| `CIPHEX_API_KEY` | Ciphex API key | Yes |
| `DATABENTO_API_KEY` | Databento API key | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `NEXTAUTH_SECRET` | NextAuth encryption key | Yes |
| `NEXTAUTH_URL` | Application URL | Yes |

---

## Performance Considerations

### Optimization Strategies

1. **Code Splitting**: Dynamic imports for chart library
2. **Data Fetching**: SWR/React Query with stale-while-revalidate
3. **WebSocket Management**: Single connection per symbol, auto-reconnect
4. **Image Optimization**: Next.js Image component
5. **Bundle Size**: Tree-shaking, minimal dependencies

### Target Metrics

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s |
| Time to Interactive | < 3s |
| Lighthouse Score | > 90 |
| Chart Render | < 500ms |

---

## Security

### Measures

1. **API Keys**: Server-side only, never exposed to client
2. **CORS**: Handled by Next.js API routes
3. **Auth**: JWT with secure httpOnly cookies
4. **Input Validation**: Zod schemas on all endpoints
5. **Rate Limiting**: Vercel edge rate limiting

### Sensitive Data

- API keys stored in Vercel environment variables
- User sessions encrypted with NEXTAUTH_SECRET
- Database credentials in secure environment

---

## Development Phases

### Phase 1: MVP (Week 1-2)
- [ ] Scaffold Next.js application
- [ ] Port POC chart to React component
- [ ] Implement Ciphex API integration
- [ ] Implement Binance integration
- [ ] Deploy to Vercel

### Phase 2: Stocks + Auth (Week 3-4)
- [ ] Integrate Databento for stocks
- [ ] Add NextAuth authentication
- [ ] Implement watchlist feature
- [ ] Add user preferences

### Phase 3: Polish (Week 5-6)
- [ ] Real-time WebSocket updates
- [ ] Mobile responsive design
- [ ] Performance optimization
- [ ] Error handling + monitoring

### Phase 4: Enhancements (Future)
- [ ] Price alerts
- [ ] Historical accuracy tracking
- [ ] Multi-chart layouts
- [ ] Mobile app (React Native)

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Page Load Time | < 2 seconds |
| Prediction Data Freshness | < 5 minutes |
| Uptime | 99.9% |
| User Satisfaction | Qualitative feedback |

---

## Appendix

### Asset UUID Mapping

See `config/assets.ts` for complete UUID-to-symbol mappings.

### API Response Examples

See `docs/api-examples.md` for sample API responses.

### POC Reference

The working proof-of-concept is available at `webapp/index.html` and can be run locally with:

```bash
cd webapp && python3 server.py
# Open http://localhost:8080
```
