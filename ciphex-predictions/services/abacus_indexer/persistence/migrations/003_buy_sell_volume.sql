-- Migration: 003_buy_sell_volume
-- Description: Add buy/sell volume separation columns to composite_bars and venue_bars
-- Date: 2026-01-02
--
-- This migration adds taker-initiated buy/sell volume tracking for forecasting.
-- Per POC team recommendation:
--   - buy = taker-initiated buys (aggressive buys, lifting the ask)
--   - sell = taker-initiated sells (aggressive sells, hitting the bid)
--
-- All columns have DEFAULT 0 so existing rows remain valid.
-- Run this BEFORE deploying v0.1.13.

-- Add buy/sell columns to composite_bars
ALTER TABLE composite_bars
    ADD COLUMN IF NOT EXISTS buy_volume DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sell_volume DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS buy_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sell_count INTEGER NOT NULL DEFAULT 0;

-- Add buy/sell columns to venue_bars
ALTER TABLE venue_bars
    ADD COLUMN IF NOT EXISTS buy_volume DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sell_volume DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS buy_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sell_count INTEGER NOT NULL DEFAULT 0;

-- Record migration
INSERT INTO schema_migrations (version, description)
VALUES ('003_buy_sell_volume', 'Add buy/sell volume separation to composite_bars and venue_bars (forecasting order flow)')
ON CONFLICT (version) DO NOTHING;

-- Verification query (optional)
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name IN ('composite_bars', 'venue_bars')
--   AND column_name IN ('buy_volume', 'sell_volume', 'buy_count', 'sell_count');
