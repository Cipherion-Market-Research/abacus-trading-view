#!/usr/bin/env python3
"""Test script to list available schemas for EQUS.MINI"""

import databento as db
import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("DATABENTO_API_KEY")

# Create a historical client to check metadata
client = db.Historical(key=api_key)

# List available schemas for EQUS.MINI
try:
    metadata = client.metadata.list_schemas(dataset="EQUS.MINI")
    print("Available schemas for EQUS.MINI:")
    for schema in metadata:
        print(f"  - {schema}")
except Exception as e:
    print(f"Error getting schemas: {e}")
