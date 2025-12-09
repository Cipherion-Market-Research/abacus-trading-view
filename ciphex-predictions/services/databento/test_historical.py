#!/usr/bin/env python3
"""Test script to get historical OHLCV data for EQUS.MINI"""

import databento as db
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("DATABENTO_API_KEY")

# Create a historical client
client = db.Historical(key=api_key)

# Get recent OHLCV data
# Historical API has ~15 min delay, so adjust end time
now = datetime.utcnow()
end = (now - timedelta(minutes=20)).isoformat()
start = (now - timedelta(hours=2)).isoformat()

print(f"Fetching OHLCV-1m data from {start} to {end}")
print("Symbol: AAPL")

try:
    data = client.timeseries.get_range(
        dataset="EQUS.MINI",
        symbols=["AAPL"],
        schema="ohlcv-1m",
        start=start,
        end=end,
    )

    count = 0
    for record in data:
        count += 1
        if count <= 5:  # Print first 5 records
            print(f"\nRecord {count}:")
            print(f"  Type: {type(record).__name__}")
            print(f"  ts_event: {record.ts_event}")
            if hasattr(record, 'open'):
                print(f"  O: {float(record.open)/1e9:.2f} H: {float(record.high)/1e9:.2f} L: {float(record.low)/1e9:.2f} C: {float(record.close)/1e9:.2f}")
                print(f"  Volume: {record.volume}")
            if hasattr(record, 'symbol'):
                print(f"  Symbol: {record.symbol}")
            if hasattr(record, 'instrument_id'):
                print(f"  instrument_id: {record.instrument_id}")

    print(f"\nTotal records: {count}")

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
