import os
import requests
from functools import lru_cache

# Cache currency rates for 1 hour (conceptually, lru_cache handles memory)
# In production, use Redis.
@lru_cache(maxsize=1)
def get_exchange_rates(base_currency="USD"):
    """
    Fetches real-time exchange rates.
    Uses ExchangeRate-API (Free Tier).
    """
    try:
        # Fallback/Demo API Key or Public Endpoint
        # Using open.er-api.com which is free and requires no key
        url = f"https://open.er-api.com/v6/latest/{base_currency}"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            return response.json().get('rates', {})
    except Exception as e:
        print(f"Currency fetch error: {e}")
        
    # Fallback rates if API fails
    return {
        "USD": 1.0,
        "EUR": 0.92,
        "GBP": 0.79,
        "INR": 83.12,
        "CNY": 7.19,
        "JPY": 148.05
    }

def convert_currency(amount, from_curr, to_curr, rates=None):
    if not rates:
        rates = get_exchange_rates()
    
    if from_curr == to_curr:
        return amount
        
    # Convert to base (USD) then to target
    # Rate is Amount of Target per 1 Base
    # If Base is USD.
    
    # Simple logic if rates are based on USD
    usd_value = amount / rates.get(from_curr, 1.0)
    target_value = usd_value * rates.get(to_curr, 1.0)
    
    return round(target_value, 2)
