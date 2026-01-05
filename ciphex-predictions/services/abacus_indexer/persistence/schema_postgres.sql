-- Abacus Indexer Database Schema (PostgreSQL Native)
-- Compatible with standard RDS PostgreSQL (no TimescaleDB required)

-- =============================================================================
-- Composite Bars Table
-- =============================================================================
-- Stores 1-minute composite OHLCV bars computed from venue medians
-- Primary table for the Abacus:INDEX service

CREATE TABLE IF NOT EXISTS composite_bars (
    -- Timestamp and identity
    time            TIMESTAMPTZ NOT NULL,
    asset           VARCHAR(10) NOT NULL,       -- BTC, ETH
    market_type     VARCHAR(10) NOT NULL,       -- spot, perp

    -- OHLCV data (NULL when is_gap=true)
    open            DOUBLE PRECISION,
    high            DOUBLE PRECISION,
    low             DOUBLE PRECISION,
    close           DOUBLE PRECISION,
    volume          DOUBLE PRECISION NOT NULL DEFAULT 0,

    -- Buy/Sell volume separation (taker-initiated, for forecasting)
    -- buy = taker-initiated buys (aggressive buys, lifting the ask)
    -- sell = taker-initiated sells (aggressive sells, hitting the bid)
    buy_volume      DOUBLE PRECISION NOT NULL DEFAULT 0,
    sell_volume     DOUBLE PRECISION NOT NULL DEFAULT 0,
    buy_count       INTEGER NOT NULL DEFAULT 0,
    sell_count      INTEGER NOT NULL DEFAULT 0,

    -- Status flags
    degraded        BOOLEAN NOT NULL DEFAULT FALSE,  -- Below preferred quorum
    is_gap          BOOLEAN NOT NULL DEFAULT FALSE,  -- Below min quorum
    is_backfilled   BOOLEAN NOT NULL DEFAULT FALSE,  -- Repaired via backfill

    -- Venue tracking
    included_venues TEXT[] NOT NULL DEFAULT '{}',    -- Venues in composite
    excluded_venues JSONB NOT NULL DEFAULT '[]',     -- [{venue, reason}]

    -- Metadata
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Primary key
    PRIMARY KEY (time, asset, market_type)
);

-- Index for querying by asset/market (primary access pattern)
CREATE INDEX IF NOT EXISTS idx_composite_bars_asset_market
    ON composite_bars (asset, market_type, time DESC);

-- Index for gap detection queries
CREATE INDEX IF NOT EXISTS idx_composite_bars_gaps
    ON composite_bars (asset, market_type, time DESC)
    WHERE is_gap = TRUE;


-- =============================================================================
-- Venue Bars Table (Per-Exchange OHLCV for Forecasting Traceability)
-- =============================================================================
-- Stores per-venue 1-minute OHLCV bars BEFORE composite aggregation.
-- Critical for forecasting validation and debugging divergence.
-- Mirrors MultiCEXResolver's per-exchange data capability.

CREATE TABLE IF NOT EXISTS venue_bars (
    -- Timestamp and identity
    time            TIMESTAMPTZ NOT NULL,
    asset           VARCHAR(10) NOT NULL,       -- BTC, ETH
    market_type     VARCHAR(10) NOT NULL,       -- spot, perp
    venue           VARCHAR(20) NOT NULL,       -- binance, coinbase, etc.

    -- OHLCV data
    open            DOUBLE PRECISION NOT NULL,
    high            DOUBLE PRECISION NOT NULL,
    low             DOUBLE PRECISION NOT NULL,
    close           DOUBLE PRECISION NOT NULL,
    volume          DOUBLE PRECISION NOT NULL DEFAULT 0,
    trade_count     INTEGER NOT NULL DEFAULT 0,

    -- Buy/Sell volume separation (taker-initiated, for forecasting)
    -- buy = taker-initiated buys (aggressive buys, lifting the ask)
    -- sell = taker-initiated sells (aggressive sells, hitting the bid)
    buy_volume      DOUBLE PRECISION NOT NULL DEFAULT 0,
    sell_volume     DOUBLE PRECISION NOT NULL DEFAULT 0,
    buy_count       INTEGER NOT NULL DEFAULT 0,
    sell_count      INTEGER NOT NULL DEFAULT 0,

    -- Composite relationship
    included_in_composite BOOLEAN NOT NULL DEFAULT TRUE,
    exclude_reason  VARCHAR(20),                -- 'stale', 'outlier', null if included

    -- Metadata
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Primary key
    PRIMARY KEY (time, asset, market_type, venue)
);

-- Index for querying by asset/market/venue (primary access pattern)
CREATE INDEX IF NOT EXISTS idx_venue_bars_asset_market_venue
    ON venue_bars (asset, market_type, venue, time DESC);

-- Index for querying all venues at a timestamp (for composite validation)
CREATE INDEX IF NOT EXISTS idx_venue_bars_time_asset
    ON venue_bars (time, asset, market_type);


-- =============================================================================
-- Venue Telemetry Table (Optional - for historical analysis)
-- =============================================================================
-- Snapshot of venue connection state over time

CREATE TABLE IF NOT EXISTS venue_telemetry (
    time            TIMESTAMPTZ NOT NULL,
    venue           VARCHAR(20) NOT NULL,
    asset           VARCHAR(10) NOT NULL,
    market_type     VARCHAR(10) NOT NULL,
    connection_state VARCHAR(20) NOT NULL,       -- connected, disconnected, etc.
    message_count   BIGINT NOT NULL DEFAULT 0,
    trade_count     BIGINT NOT NULL DEFAULT 0,
    reconnect_count INT NOT NULL DEFAULT 0,
    uptime_percent  DOUBLE PRECISION,

    PRIMARY KEY (time, venue, asset, market_type)
);

-- Index for querying venue telemetry by venue
CREATE INDEX IF NOT EXISTS idx_venue_telemetry_venue
    ON venue_telemetry (venue, asset, market_type, time DESC);


-- =============================================================================
-- Migrations Table (for tracking schema changes)
-- =============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version         VARCHAR(50) PRIMARY KEY,
    applied_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description     TEXT
);

-- Record migrations
INSERT INTO schema_migrations (version, description)
VALUES ('001_initial_schema_postgres', 'Initial Abacus Indexer schema (PostgreSQL native, no TimescaleDB)')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version, description)
VALUES ('002_venue_bars_table', 'Add venue_bars table for per-exchange OHLCV traceability (forecasting support)')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version, description)
VALUES ('003_buy_sell_volume', 'Add buy/sell volume separation to composite_bars and venue_bars (forecasting order flow)')
ON CONFLICT (version) DO NOTHING;
