#!/usr/bin/env python3
"""Test script to verify Live API OHLCV streaming"""

import databento as db
import os
import asyncio
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("DATABENTO_API_KEY")

async def main():
    print("Starting Live API test...")
    print("Subscribing to EQUS.MINI ohlcv-1m for AAPL with start=0")

    live = db.Live(key=api_key)

    live.subscribe(
        dataset="EQUS.MINI",
        schema="ohlcv-1m",
        symbols=["AAPL"],
        start=0,  # Replay from midnight UTC
    )

    print("Subscription created, waiting for records...")

    count = 0
    async for record in live:
        count += 1
        record_type = type(record).__name__
        print(f"\nRecord {count}: {record_type}")

        if hasattr(record, 'instrument_id'):
            print(f"  instrument_id: {record.instrument_id}")

        if hasattr(record, 'raw_symbol'):
            print(f"  raw_symbol: {record.raw_symbol}")

        if hasattr(record, 'stype_in_symbol'):
            print(f"  stype_in_symbol: {record.stype_in_symbol}")
        if hasattr(record, 'stype_out_symbol'):
            print(f"  stype_out_symbol: {record.stype_out_symbol}")

        if 'Ohlcv' in record_type:
            print(f"  O: {float(record.open)/1e9:.2f} H: {float(record.high)/1e9:.2f} L: {float(record.low)/1e9:.2f} C: {float(record.close)/1e9:.2f}")
            print(f"  Volume: {record.volume}")
            print(f"  ts_event: {record.ts_event}")

        if hasattr(record, 'msg') and record_type == 'SystemMsg':
            print(f"  msg: {record.msg}")

        # Print all attributes for SymbolMappingMsg
        if record_type == 'SymbolMappingMsg':
            for attr in dir(record):
                if not attr.startswith('_'):
                    try:
                        val = getattr(record, attr)
                        if not callable(val):
                            print(f"  {attr}: {val}")
                    except:
                        pass

        if count >= 30:  # Stop after 30 records
            print("\n--- Stopping after 30 records ---")
            break

    live.stop()

if __name__ == "__main__":
    asyncio.run(main())
