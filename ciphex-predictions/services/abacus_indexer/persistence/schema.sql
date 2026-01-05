-- Abacus Indexer Database Schema
-- TimescaleDB required for hypertables

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

-- Convert to TimescaleDB hypertable (1 day chunks)
SELECT create_hypertable(
    'composite_bars',
    'time',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Enable compression after 7 days
ALTER TABLE composite_bars SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'asset,market_type'
);

SELECT add_compression_policy(
    'composite_bars',
    INTERVAL '7 days',
    if_not_exists => TRUE
);

-- Index for querying by asset/market
CREATE INDEX IF NOT EXISTS idx_composite_bars_asset_market
    ON composite_bars (asset, market_type, time DESC);

-- Index for gap detection queries
CREATE INDEX IF NOT EXISTS idx_composite_bars_gaps
    ON composite_bars (asset, market_type, time DESC)
    WHERE is_gap = TRUE;


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

SELECT create_hypertable(
    'venue_telemetry',
    'time',
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- Retention policy: keep 30 days of telemetry
SELECT add_retention_policy(
    'venue_telemetry',
    INTERVAL '30 days',
    if_not_exists => TRUE
);


-- =============================================================================
-- Migrations Table (for tracking schema changes)
-- =============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version         VARCHAR(50) PRIMARY KEY,
    applied_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description     TEXT
);

-- Record this migration
INSERT INTO schema_migrations (version, description)
VALUES ('001_initial_schema', 'Initial Abacus Indexer schema with composite_bars and venue_telemetry')
ON CONFLICT (version) DO NOTHING;
