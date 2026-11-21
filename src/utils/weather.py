import json
import urllib.request
import urllib.parse
from typing import Optional, Dict, Any
from functools import lru_cache
from src.utils.geo import geolocator

def _fetch_json(url: str, params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    try:
        query = urllib.parse.urlencode(params)
        full_url = f"{url}?{query}"
        req = urllib.request.Request(full_url, headers={"User-Agent": "PlanA-Logistics/1.0"})
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status != 200:
                return None
            data = response.read()
            return json.loads(data)
    except Exception as e:
        print(f"Error fetching JSON from {url}: {e}")
        return None

@lru_cache(maxsize=200)
def get_weather_summary(location: str) -> str:
    """
    Fetches current weather for a location using Open-Meteo (Free, No Key).
    """
    if not location:
        return ""

    try:
        # 1. Geocode
        # Using geolocator from geo.py which uses Nominatim
        loc = geolocator.geocode(location)
        if not loc:
            return ""
        
        lat, lon = loc.latitude, loc.longitude

        # 2. Fetch Weather
        # https://open-meteo.com/en/docs
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": lat,
            "longitude": lon,
            "current_weather": "true",
            "windspeed_unit": "ms"
        }
        
        data = _fetch_json(url, params)
        if not data:
            return ""
            
        current = data.get("current_weather")
        if not current:
            return ""
            
        # 3. Format
        temp = current.get("temperature")
        wind = current.get("windspeed")
        
        parts = []
        if temp is not None:
            parts.append(f"temperature {temp}C")
        if wind is not None:
            parts.append(f"wind {wind}m/s")
            
        return ", ".join(parts)

    except Exception as e:
        print(f"Weather fetch error for {location}: {e}")
        return ""
