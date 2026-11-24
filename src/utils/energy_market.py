"""Server-side Twelve Data quotes with an account-friendly shared cache."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from threading import Lock
from time import monotonic
from typing import Any, Dict

import os
import requests

QUOTE_TTL_SECONDS = 720
QUOTE_TIMEOUT_SECONDS = 8
ASSETS = [
    {"symbol": "XOM", "name": "Exxon Mobil", "type": "Energy company", "unit": "USD / share"},
    {"symbol": "CVX", "name": "Chevron", "type": "Energy company", "unit": "USD / share"},
    {"symbol": "SHEL", "name": "Shell", "type": "Energy company", "unit": "USD / share"},
    {"symbol": "BP", "name": "BP", "type": "Energy company", "unit": "USD / share"},
    {"symbol": "COP", "name": "ConocoPhillips", "type": "Energy company", "unit": "USD / share"},
    {"symbol": "OXY", "name": "Occidental Petroleum", "type": "Energy company", "unit": "USD / share"},
]

_cache_lock = Lock()
_cached_quotes: Dict[str, Any] = {"expires_at": 0.0, "data": None}


class EnergyMarketError(Exception):
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code


def _number(value: Any):
    try:
        number = float(value)
        return number if number == number and abs(number) != float("inf") else None
    except (TypeError, ValueError):
        return None


def _fetch_quote(asset: Dict[str, str], api_key: str) -> Dict[str, Any]:
    try:
        response = requests.get(
            "https://api.twelvedata.com/quote",
            params={"symbol": asset["symbol"], "apikey": api_key},
            timeout=QUOTE_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        payload = response.json()
        price = _number(payload.get("close") or payload.get("last"))
        if payload.get("status") == "error" or price is None:
            return {**asset, "price": None, "change": None, "percent_change": None, "quote_time": None, "available": False}

        return {
            **asset,
            "price": price,
            "change": _number(payload.get("change")),
            "percent_change": _number(payload.get("percent_change")),
            "currency": payload.get("currency") or "USD",
            "quote_time": payload.get("datetime"),
            "market_open": payload.get("is_market_open"),
            "available": True,
        }
    except (requests.RequestException, ValueError):
        return {**asset, "price": None, "change": None, "percent_change": None, "quote_time": None, "available": False}


def get_energy_market_quotes():
    api_key = os.getenv("TWELVE_DATA_API_KEY", "").strip()
    if not api_key:
        raise EnergyMarketError(503, "Twelve Data API key is not configured on the server.")

    now = monotonic()
    with _cache_lock:
        if _cached_quotes["data"] and now < _cached_quotes["expires_at"]:
            return {**_cached_quotes["data"], "cached": True}

    with ThreadPoolExecutor(max_workers=len(ASSETS)) as executor:
        quotes = list(executor.map(lambda asset: _fetch_quote(asset, api_key), ASSETS))

    data = {
        "provider": "Twelve Data",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "cached": False,
        "quotes": quotes,
    }

    if not any(quote["available"] for quote in quotes):
        raise EnergyMarketError(502, "Twelve Data did not return quotes. Check API access and supported symbols.")

    with _cache_lock:
        _cached_quotes["data"] = data
        _cached_quotes["expires_at"] = monotonic() + QUOTE_TTL_SECONDS
    return data
