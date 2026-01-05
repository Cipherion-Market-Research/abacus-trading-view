"""
Abacus Indexer Backfill Module

Provides gap detection and historical data repair via exchange REST APIs.
"""

from .service import BackfillService, BackfillResult

__all__ = ["BackfillService", "BackfillResult"]
