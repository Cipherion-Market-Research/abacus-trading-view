#!/usr/bin/env python3
"""
Databento Stock Data Streaming Service

This service connects to Databento's live API and streams OHLCV data
for stocks to the Next.js frontend via Server-Sent Events (SSE).

Architecture:
  Databento (TCP) -> This Service (FastAPI) -> Next.js (SSE) -> Browser
"""

import os
import json
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from collections import defaultdict
from contextlib import asynccontextmanager

import databento as db
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from dotenv import load_dotenv

load_dotenv()


import sys

def log(msg):
    """Print with flush for immediate output."""
    print(msg, flush=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown."""
    log("Starting up...")

    # Fetch historical data first to populate the cache
    await fetch_historical_data()

    # Then start the live stream
    log("Starting Databento live stream task")
    task = asyncio.create_task(start_databento_stream())
    log("Databento stream task created")
    yield
    # Shutdown - properly close Databento connections
    log("Shutting down...")
    global live_client
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    if live_client:
        try:
            live_client.stop()
            log("Databento live client stopped")
        except Exception as e:
            log(f"Error stopping live client: {e}")
        live_client = None
    log("Shutdown complete")


app = FastAPI(title="Databento Stock Streamer", lifespan=lifespan)

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Stock symbols we support (from config)
SUPPORTED_SYMBOLS = [
    "AAPL", "AMZN", "NVDA", "TSLA", "META", "MSFT", "GOOGL", "GOOG",
    "SPY", "QQQ", "DIA", "IWM", "XLK", "XLF", "XLE", "XLI", "XLP", "XLV"
]

# Store latest candles for each symbol (for initial load)
candle_cache: Dict[str, List[dict]] = defaultdict(list)
MAX_CACHE_SIZE = 1500  # ~24 hours of 1-minute candles

# Subscribers for SSE
subscribers: Dict[str, List[asyncio.Queue]] = defaultdict(list)

# Databento client
live_client: Optional[db.Live] = None

# Mapping from instrument_id to symbol
# Pre-populated with known mappings from EQUS.MINI, updated dynamically from SymbolMappingMsg
instrument_map: Dict[int, str] = {
    38: "AAPL",
    853: "AMZN",
    4341: "DIA",
    7151: "GOOG",
    7152: "GOOGL",
    8880: "IWM",
    10451: "META",
    10888: "MSFT",
    11667: "NVDA",
    13340: "QQQ",
    15144: "SPY",
    16244: "TSLA",
    17676: "XLE",
    17678: "XLF",
    17680: "XLI",
    17681: "XLK",
    17684: "XLP",
    17692: "XLV",
}


def format_candle(record, symbol: str) -> dict:
    """Convert Databento OHLCV record to our candle format."""
    return {
        "time": int(record.ts_event / 1_000_000_000),  # nanoseconds to seconds
        "open": float(record.open) / 1e9,  # Fixed-point to float
        "high": float(record.high) / 1e9,
        "low": float(record.low) / 1e9,
        "close": float(record.close) / 1e9,
        "volume": int(record.volume),
        "symbol": symbol,
    }


record_count = 0
ohlcv_count = 0

def on_record(record):
    """Callback for Databento live data."""
    global record_count, ohlcv_count, instrument_map
    try:
        record_count += 1
        record_type = type(record).__name__

        # Handle SymbolMappingMsg to build instrument_id -> symbol mapping
        if record_type == 'SymbolMappingMsg':
            instrument_id = record.instrument_id
            symbol = getattr(record, 'stype_in_symbol', None) or getattr(record, 'stype_out_symbol', None)
            if symbol and instrument_id:
                instrument_map[instrument_id] = symbol
                if len(instrument_map) <= 20:
                    log(f"Mapped instrument_id {instrument_id} -> {symbol}")
            return

        # Skip non-OHLCV records (SystemMsg, etc)
        if 'Ohlcv' not in record_type:
            return

        # Get symbol from instrument_id mapping
        instrument_id = getattr(record, 'instrument_id', None)
        if instrument_id is None:
            return

        symbol = instrument_map.get(instrument_id)
        if not symbol:
            # Debug: only log first few unknown instrument_ids
            if record_count <= 50:
                log(f"Unknown instrument_id: {instrument_id}")
            return

        candle = format_candle(record, symbol)
        ohlcv_count += 1

        # Add to cache
        candle_cache[symbol].append(candle)
        if len(candle_cache[symbol]) > MAX_CACHE_SIZE:
            candle_cache[symbol] = candle_cache[symbol][-MAX_CACHE_SIZE:]

        # Debug: print when we get data for a new symbol
        if len(candle_cache[symbol]) == 1:
            log(f"First candle for {symbol}: O={candle['open']:.2f} H={candle['high']:.2f} L={candle['low']:.2f} C={candle['close']:.2f} V={candle['volume']}")

        # Progress update every 100 OHLCV records
        if ohlcv_count % 100 == 0:
            log(f"Processed {ohlcv_count} OHLCV records, {len(candle_cache)} symbols cached")

        # Broadcast to subscribers
        for queue in subscribers.get(symbol, []):
            try:
                queue.put_nowait(candle)
            except asyncio.QueueFull:
                pass  # Drop if queue is full

    except Exception as e:
        log(f"Error processing record: {e}")
        import traceback
        traceback.print_exc()


async def fetch_historical_data():
    """Fetch historical OHLCV data to populate the cache."""
    global instrument_map

    api_key = os.getenv("DATABENTO_API_KEY")
    if not api_key:
        return

    try:
        log("Fetching historical OHLCV data...")
        client = db.Historical(key=api_key)

        # Fetch last 8 hours of data (with 15min delay)
        from datetime import timezone
        now = datetime.now(timezone.utc)
        end = (now - timedelta(minutes=15)).isoformat()
        start = (now - timedelta(hours=8)).isoformat()

        log(f"Fetching from {start} to {end}")

        data = client.timeseries.get_range(
            dataset="EQUS.MINI",
            symbols=SUPPORTED_SYMBOLS,
            schema="ohlcv-1m",
            start=start,
            end=end,
        )

        # Process records directly instead of going through on_record
        count = 0
        for record in data:
            count += 1
            instrument_id = record.instrument_id
            symbol = instrument_map.get(instrument_id)

            if count <= 3:
                log(f"Historical record {count}: type={type(record).__name__}, instrument_id={instrument_id}, symbol={symbol}")

            if symbol:
                candle = format_candle(record, symbol)
                candle_cache[symbol].append(candle)
                if len(candle_cache[symbol]) > MAX_CACHE_SIZE:
                    candle_cache[symbol] = candle_cache[symbol][-MAX_CACHE_SIZE:]

        log(f"Historical data loaded: {sum(len(c) for c in candle_cache.values())} candles for {len(candle_cache)} symbols from {count} total records")

    except Exception as e:
        log(f"Error fetching historical data: {e}")
        import traceback
        traceback.print_exc()


async def start_databento_stream():
    """Start the Databento live stream for all supported symbols."""
    global live_client

    api_key = os.getenv("DATABENTO_API_KEY")
    if not api_key:
        log("WARNING: DATABENTO_API_KEY not set, stock streaming disabled")
        return

    try:
        log(f"Connecting to Databento EQUS.MINI for {len(SUPPORTED_SYMBOLS)} symbols...")
        live_client = db.Live(key=api_key)

        # Subscribe to OHLCV 1-minute bars for all supported stocks
        # Using EQUS.MINI for US equities
        # Note: We use start=None to get live data only (not replay)
        # Historical data will be fetched separately
        live_client.subscribe(
            dataset="EQUS.MINI",
            schema="ohlcv-1m",
            symbols=SUPPORTED_SYMBOLS,
        )

        log(f"Databento subscription created, starting async iteration...")

        # Process records in async loop
        async for record in live_client:
            try:
                on_record(record)
            except Exception as e:
                log(f"Error processing record: {e}")

    except Exception as e:
        log(f"Error starting Databento stream: {e}")
        import traceback
        traceback.print_exc()
        live_client = None


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "streaming": live_client is not None,
        "cached_symbols": list(candle_cache.keys()),
    }


@app.get("/api/stocks/{symbol}/candles")
async def get_candles(
    symbol: str,
    limit: int = Query(default=500, le=1500),
):
    """Get cached candles for a symbol."""
    symbol = symbol.upper()
    if symbol not in SUPPORTED_SYMBOLS:
        return {"error": f"Symbol {symbol} not supported"}

    candles = candle_cache.get(symbol, [])
    # Sort by time ascending (required by TradingView charts)
    sorted_candles = sorted(candles, key=lambda c: c['time'])
    return sorted_candles[-limit:] if len(sorted_candles) > limit else sorted_candles


@app.get("/api/stocks/{symbol}/stream")
async def stream_candles(symbol: str):
    """SSE endpoint for real-time candle updates only (no historical replay).

    Clients should first fetch historical data via /api/stocks/{symbol}/candles,
    then connect here for live updates only.
    """
    symbol = symbol.upper()
    if symbol not in SUPPORTED_SYMBOLS:
        return {"error": f"Symbol {symbol} not supported"}

    async def event_generator():
        queue = asyncio.Queue(maxsize=100)
        subscribers[symbol].append(queue)

        try:
            # Stream live updates only - clients fetch history via REST first
            while True:
                candle = await queue.get()
                yield {
                    "event": "candle",
                    "data": json.dumps(candle),
                }

        except asyncio.CancelledError:
            pass
        finally:
            subscribers[symbol].remove(queue)

    return EventSourceResponse(event_generator())


@app.get("/api/stocks/historical/{symbol}")
async def get_historical(
    symbol: str,
    interval: str = Query(default="1m"),
    start: Optional[str] = None,
    end: Optional[str] = None,
):
    """
    Get historical candles from Databento.
    Uses the historical API for data older than what's in the live cache.
    Note: Historical API has ~10-15 min delay from real-time.
    """
    symbol = symbol.upper()
    if symbol not in SUPPORTED_SYMBOLS:
        return {"error": f"Symbol {symbol} not supported"}

    api_key = os.getenv("DATABENTO_API_KEY")
    if not api_key:
        return {"error": "Databento API key not configured"}

    try:
        client = db.Historical(key=api_key)

        # Map interval to Databento schema
        schema_map = {
            "1m": "ohlcv-1m",
            "1h": "ohlcv-1h",
            "1d": "ohlcv-1d",
        }
        schema = schema_map.get(interval, "ohlcv-1m")

        # Historical API has ~15 min delay, so adjust end time
        # to avoid "data_end_after_available_end" errors
        delay_minutes = 15
        now = datetime.utcnow()

        if not end:
            end = (now - timedelta(minutes=delay_minutes)).isoformat()
        if not start:
            start = (now - timedelta(hours=48)).isoformat()  # 48 hours of data

        data = client.timeseries.get_range(
            dataset="EQUS.MINI",
            symbols=[symbol],
            schema=schema,
            start=start,
            end=end,
        )

        candles = []
        for record in data:
            candles.append(format_candle(record, symbol))

        return candles

    except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
    import uvicorn
    import signal

    def handle_signal(signum, frame):
        """Handle shutdown signals gracefully."""
        log(f"Received signal {signum}, initiating graceful shutdown...")
        # Uvicorn will handle the actual shutdown through its signal handlers
        raise SystemExit(0)

    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    uvicorn.run(app, host="0.0.0.0", port=8080)
