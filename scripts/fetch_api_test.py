#!/usr/bin/env python3
"""
Test script to fetch data from the Ciphex API and inspect the response structure.
This helps us understand how to adapt the ADR pipeline to the actual API.
"""

import os
import json
import requests
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

API_URL = os.getenv("API_URL", "").rstrip("/")
API_KEY = os.getenv("API_KEY", "")


def check_env():
    """Verify environment variables are set."""
    if not API_URL:
        print("ERROR: API_URL not set in .env")
        return False
    if not API_KEY:
        print("ERROR: API_KEY not set in .env")
        return False
    print(f"API URL: {API_URL}")
    print(f"API Key: {API_KEY[:8]}...{API_KEY[-4:]}" if len(API_KEY) > 12 else "API Key: [set]")
    return True


def make_request(endpoint, auth=True):
    """Make a request to the API and return the response."""
    url = f"{API_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}

    if auth:
        # Try X-API-Key header (common alternative to Bearer token)
        headers["X-API-Key"] = API_KEY

    print(f"\n{'='*60}")
    print(f"GET {url}")
    print(f"Auth: {'Yes' if auth else 'No'}")
    print("="*60)

    try:
        response = requests.get(url, headers=headers, timeout=30)
        print(f"Status: {response.status_code}")

        try:
            data = response.json()
            print(f"Response:\n{json.dumps(data, indent=2, default=str)}")
            return data
        except json.JSONDecodeError:
            print(f"Response (text): {response.text[:500]}")
            return None

    except requests.RequestException as e:
        print(f"Request failed: {e}")
        return None


def main():
    print("Ciphex API Test Script")
    print("="*60)

    if not check_env():
        return

    # Test 1: Health check (no auth)
    print("\n[1/3] Testing health endpoint...")
    make_request("/health", auth=False)

    # Test 2: Get assets list
    print("\n[2/3] Fetching assets list...")
    assets_response = make_request("/v1/assets", auth=True)

    # Test 3: Get dashboard for first asset (if assets exist)
    if assets_response:
        # Try to extract first asset ID - adapt based on actual response structure
        asset_id = None

        if isinstance(assets_response, list) and len(assets_response) > 0:
            # Response is a list of assets
            first_asset = assets_response[0]
            asset_id = first_asset.get("id") or first_asset.get("uuid") or first_asset.get("asset_id")
        elif isinstance(assets_response, dict):
            # Response might have assets nested
            assets = assets_response.get("assets") or assets_response.get("data") or []
            if assets and len(assets) > 0:
                first_asset = assets[0]
                asset_id = first_asset.get("id") or first_asset.get("uuid") or first_asset.get("asset_id")

        if asset_id:
            print(f"\n[3/3] Fetching dashboard for asset: {asset_id}...")
            make_request(f"/v2/assets/{asset_id}/dashboard", auth=True)
        else:
            print("\n[3/3] Could not determine asset ID from response structure")
            print("Please check the assets response above and adjust the script")
    else:
        print("\n[3/3] Skipping dashboard test - no assets data")

    print("\n" + "="*60)
    print("Test complete. Review the responses above to understand the API structure.")
    print("="*60)


if __name__ == "__main__":
    main()
