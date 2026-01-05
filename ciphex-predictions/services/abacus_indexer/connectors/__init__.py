# Abacus Indexer Venue Connectors
# WebSocket connections to exchange trade streams
"""
Venue connectors for real-time trade data ingestion.

Each connector:
- Connects to venue WebSocket API
- Parses venue-specific trade messages
- Feeds trades to BarBuilder for OHLCV construction
- Handles reconnection with exponential backoff
- Tracks telemetry (message count, uptime, etc.)
"""

from .base import BaseConnector, ConnectorState
from .binance import (
    BinanceConnector,
    BinanceSpotConnector,
    BinancePerpConnector,
)
from .coinbase import (
    CoinbaseConnector,
    CoinbaseSpotConnector,
)
from .kraken import (
    KrakenConnector,
    KrakenSpotConnector,
)
from .okx import (
    OKXConnector,
    OKXSpotConnector,
    OKXPerpConnector,
)
from .bybit import (
    BybitConnector,
    BybitPerpConnector,
)

__all__ = [
    "BaseConnector",
    "ConnectorState",
    "BinanceConnector",
    "BinanceSpotConnector",
    "BinancePerpConnector",
    "CoinbaseConnector",
    "CoinbaseSpotConnector",
    "KrakenConnector",
    "KrakenSpotConnector",
    "OKXConnector",
    "OKXSpotConnector",
    "OKXPerpConnector",
    "BybitConnector",
    "BybitPerpConnector",
]
