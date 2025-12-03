#!/usr/bin/env python3
"""
Capture Market Mood Data
Runs hourly via GitHub Actions to store real historical data for trails.
Stores:
- Hourly snapshots (last 24 hours) for daily trail
- Daily snapshots (last 7 days) for weekly trail
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
import urllib.request
import urllib.error

# Paths
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent / "data"
MOOD_HISTORY_FILE = DATA_DIR / "mood-history.json"

# CoinGecko APIs
GLOBAL_API = "https://api.coingecko.com/api/v3/global"
COINS_API = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h"

# Retention
MAX_HOURLY_POINTS = 25  # ~24 hours + buffer
MAX_DAILY_POINTS = 8    # 7 days + buffer


def fetch_json(url: str) -> dict:
    """Fetch JSON from URL."""
    req = urllib.request.Request(url, headers={"User-Agent": "TheLitmus/1.0"})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode())


def calculate_mood_data() -> dict:
    """Calculate current market mood metrics."""
    # Fetch global data
    global_data = fetch_json(GLOBAL_API)
    
    # Fetch top 100 coins
    coins = fetch_json(COINS_API)
    
    # Calculate breadth (% of coins that are green)
    green_coins = sum(1 for c in coins if (c.get("price_change_percentage_24h") or 0) > 0)
    breadth = (green_coins / len(coins)) * 100 if coins else 50
    
    # Calculate M/V ratio
    total_market_cap = global_data.get("data", {}).get("total_market_cap", {}).get("usd", 0)
    total_volume = global_data.get("data", {}).get("total_volume", {}).get("usd", 0)
    mv_ratio = total_market_cap / total_volume if total_volume > 0 else 20
    
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "breadth": round(breadth, 1),
        "mv": round(mv_ratio, 1),
        "market_cap": total_market_cap,
        "volume": total_volume,
        "green_coins": green_coins,
        "total_coins": len(coins)
    }


def load_history() -> dict:
    """Load existing history or create new structure."""
    if MOOD_HISTORY_FILE.exists():
        try:
            with open(MOOD_HISTORY_FILE, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    
    return {
        "hourly": [],
        "daily": [],
        "last_daily_capture": None
    }


def save_history(history: dict):
    """Save history to file."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(MOOD_HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2)


def should_capture_daily(history: dict) -> bool:
    """Check if we should capture a daily snapshot (once per day at ~00:00 UTC)."""
    now = datetime.now(timezone.utc)
    
    # Capture daily if:
    # 1. Never captured before, OR
    # 2. Last capture was on a different day
    last_capture = history.get("last_daily_capture")
    if not last_capture:
        return True
    
    try:
        last_date = datetime.fromisoformat(last_capture.replace("Z", "+00:00")).date()
        return now.date() > last_date
    except (ValueError, AttributeError):
        return True


def main():
    print(f"[{datetime.now(timezone.utc).isoformat()}] Capturing market mood data...")
    
    try:
        # Calculate current mood
        current = calculate_mood_data()
        print(f"  Breadth: {current['breadth']}% ({current['green_coins']}/{current['total_coins']} green)")
        print(f"  M/V Ratio: {current['mv']}x")
        
        # Load history
        history = load_history()
        
        # Add hourly point
        hourly_point = {
            "timestamp": current["timestamp"],
            "breadth": current["breadth"],
            "mv": current["mv"]
        }
        history["hourly"].append(hourly_point)
        
        # Trim to last 24 hours
        history["hourly"] = history["hourly"][-MAX_HOURLY_POINTS:]
        print(f"  Hourly points: {len(history['hourly'])}")
        
        # Check if we should add daily point
        if should_capture_daily(history):
            daily_point = {
                "timestamp": current["timestamp"],
                "breadth": current["breadth"],
                "mv": current["mv"],
                "market_cap": current["market_cap"],
                "volume": current["volume"]
            }
            history["daily"].append(daily_point)
            history["daily"] = history["daily"][-MAX_DAILY_POINTS:]
            history["last_daily_capture"] = current["timestamp"]
            print(f"  Daily snapshot captured! Total daily points: {len(history['daily'])}")
        
        # Save
        save_history(history)
        print(f"  Saved to {MOOD_HISTORY_FILE}")
        
        return 0
        
    except urllib.error.URLError as e:
        print(f"  ERROR: Network error - {e}")
        return 1
    except Exception as e:
        print(f"  ERROR: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
