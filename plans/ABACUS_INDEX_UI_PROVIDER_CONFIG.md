# Abacus:INDEX — UI Provider Config (Browser POC vs ECS API)

## Goal

Enable the frontend to choose **where Abacus candles come from**:

- **Browser POC provider** (current): client connects directly to exchanges via WS.
- **ECS API provider** (production): client fetches from the Abacus Indexer (`/v0/candles`, `/v0/latest`, `/v0/stream`).

This keeps the UI stable while you transition from POC → production.

Reference integration point: [`ciphex-predictions/src/app/page.tsx`](ciphex-predictions/src/app/page.tsx:19)

---

## What is needed in this repo (recommended)

### 1) A small config surface (env-based)

Add environment variables (example names):

- `NEXT_PUBLIC_ABACUS_PROVIDER` = `browser` | `api`
- `NEXT_PUBLIC_ABACUS_API_BASE_URL` = `https://<your-indexer-domain>`

Rationale:

- `NEXT_PUBLIC_*` is required for Next.js to expose to the browser.
- Production deployments (Vercel) can set these per environment (preview/staging/prod).

### 2) A provider abstraction at the hook level

Keep the UI’s existing contract unchanged.

Current UI consumes Abacus candles via [`useAbacusCandles()`](ciphex-predictions/src/features/abacus-index/hooks/useAbacusCandles.ts:1).

Recommended approach:

- Keep the existing browser-WS implementation as `useAbacusCandlesBrowser()`.
- Add a new API-backed implementation `useAbacusCandlesApi()`.
- Implement a wrapper `useAbacusCandles()` that dispatches based on `NEXT_PUBLIC_ABACUS_PROVIDER`.

This ensures the toggle in [`Dashboard`](ciphex-predictions/src/app/page.tsx:19) can remain unchanged.

### 3) UI behavior when provider is `api`

Recommended semantics:

- Chart candles: fetch backfill from `GET /v0/candles` (canonical 1m).
- Current price: use `GET /v0/latest` for initial state.
- Live updates: prefer `GET /v0/stream` (SSE). On reconnect, call `/v0/latest` first.

API contract reference: [`plans/ECS_HANDOFF_PACKAGE.md`](plans/ECS_HANDOFF_PACKAGE.md:127)

---

## Why this is worth doing

The browser provider is appropriate for POC/debugging but does not scale:

- POC-2 opens 4 spot + 3 perp WS connections per active user (see [`AbacusIndexDebug`](ciphex-predictions/src/features/abacus-index/components/AbacusIndexDebug.tsx:52)).

The ECS provider centralizes WS connections server-side and provides one canonical stream to all clients.

---

## Minimal checklist (implementation order)

1) Add env vars + document in `.env.example`.
2) Add `useAbacusCandlesApi()` that hits `/v0/candles` + `/v0/latest`.
3) Add SSE client for `/v0/stream` (optional at first; polling `/v0/latest` is an acceptable fallback).
4) Add provider switch wrapper.
5) Keep browser provider accessible behind `NEXT_PUBLIC_ABACUS_PROVIDER=browser` for debugging.

