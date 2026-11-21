import pycountry
from geopy.geocoders import Photon
from geopy.distance import geodesic
from functools import lru_cache

import os
import json

# Initialize Geocoder using Photon (no strict API limits like Nominatim)
geolocator = Photon(user_agent="sscms_logistics_app_v2", timeout=10)

# Load Country Logistics Data
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LOGISTICS_DB_PATH = os.path.join(BASE_DIR, "src", "data", "country_logistics.json")

def _load_logistics_data():
    try:
        with open(LOGISTICS_DB_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading country logistics data: {e}")
        return {}

COUNTRY_LOGISTICS = _load_logistics_data()

# Pre-defined coordinates for major trade hubs to ensure speed/reliability
COUNTRY_COORDS = {
    "United States": (37.0902, -95.7129),
    "China": (35.8617, 104.1954),
    "India": (20.5937, 78.9629),
    "United Kingdom": (55.3781, -3.4360),
    "Germany": (51.1657, 10.4515),
    "France": (46.2276, 2.2137),
    "Japan": (36.2048, 138.2529),
    "Brazil": (-14.2350, -51.9253),
    "Australia": (-25.2744, 133.7751),
    "Canada": (56.1304, -106.3468),
    "Russia": (61.5240, 105.3188),
    "South Africa": (-30.5595, 22.9375),
    "United Arab Emirates": (23.4241, 53.8478),
    "Singapore": (1.3521, 103.8198),
    "Netherlands": (52.1326, 5.2913),
    "Italy": (41.8719, 12.5674),
    "Spain": (40.4637, -3.7492),
    "South Korea": (35.9078, 127.7669),
    "Mexico": (23.6345, -102.5528),
    "Indonesia": (-0.7893, 113.9213),
    "Afghanistan": (33.9391, 67.7100),
    "Belarus": (53.7098, 27.9534)
}

# Major Ports Database (Expanded for demo "Real World" feel)
COUNTRY_PORTS = {
    "India": {
        "sea": {"Nhava Sheva": (18.95, 72.95), "Mundra": (22.84, 69.70), "Chennai": (13.08, 80.27)},
        "air": {"Delhi (DEL)": (28.55, 77.10), "Mumbai (BOM)": (19.08, 72.87), "Bangalore (BLR)": (13.19, 77.70)},
        "road": {"Attari Border": (31.60, 74.60), "Petrapole": (23.03, 88.88)}
    },
    "China": {
        "sea": {"Shanghai": (31.23, 121.47), "Ningbo": (29.86, 121.52), "Shenzhen": (22.54, 114.05)},
        "air": {"Shanghai (PVG)": (31.14, 121.80), "Beijing (PEK)": (40.07, 116.60), "Guangzhou (CAN)": (23.39, 113.29)},
        "road": {"Khorgos": (44.21, 80.41), "Ruili": (24.01, 97.85)}
    },
    "United States": {
        "sea": {"Los Angeles": (33.74, -118.28), "New York": (40.71, -74.00), "Houston": (29.76, -95.36)},
        "air": {"JFK": (40.64, -73.77), "LAX": (33.94, -118.40), "Chicago (ORD)": (41.97, -87.90)},
        "road": {"Laredo": (27.50, -99.50), "Detroit": (42.33, -83.04)}
    },
    "Germany": {
        "sea": {"Hamburg": (53.54, 9.98), "Bremerhaven": (53.54, 8.58)},
        "air": {"Frankfurt (FRA)": (50.03, 8.57), "Munich (MUC)": (48.35, 11.78)},
        "road": {"Aachen": (50.77, 6.08), "Frankfurt (Oder)": (52.35, 14.55)}
    },
    "United Kingdom": {
        "sea": {"Felixstowe": (51.96, 1.35), "Southampton": (50.90, -1.40)},
        "air": {"London Heathrow (LHR)": (51.47, -0.45), "Manchester (MAN)": (53.36, -2.27)},
        "road": {"Dover": (51.12, 1.31)}
    },
    "Netherlands": {
        "sea": {"Rotterdam": (51.92, 4.47)},
        "air": {"Amsterdam (AMS)": (52.31, 4.76)},
        "road": {"Venlo": (51.37, 6.17)}
    },
     "United Arab Emirates": {
        "sea": {"Jebel Ali": (25.01, 55.06)},
        "air": {"Dubai (DXB)": (25.25, 55.36)},
        "road": {"Ghuwaifat": (24.13, 51.61)}
    },
    "Belarus": {
        "sea": {}, 
        "air": {"Minsk (MSQ)": (53.88, 28.03)},
        "road": {"Brest": (52.09, 23.68), "Kozlovichi": (52.13, 23.65)}
    }
}

# Countries that are islands or geographically isolated from road networks
ISLAND_COUNTRIES = {
    "Japan", "Australia", "New Zealand", "Indonesia", "Philippines", 
    "Taiwan", "Sri Lanka", "Madagascar", "Iceland", "Cuba", "Jamaica",
    "Haiti", "Dominican Republic", "Cyprus", "Malta", "Fiji", "Ireland"
}
# Note: Ireland is an island but often accessible via ferry from UK/EU.
# However, strictly speaking, "Road" transport requires a ferry (Multimodal).
# If we are strict "no fake data", Road implies driving. 
# But for UK<->Ireland, trucks drive on ferries. 
# We will handle UK<->Ireland exception in code.

def get_ports_for_country(country_name):
    """Returns ports dictionary for a country if available."""
    return COUNTRY_PORTS.get(country_name, {})

def get_all_countries():
    """Returns a list of all country names."""
    return sorted([country.name for country in pycountry.countries])


CACHE_FILE = os.path.join(BASE_DIR, "src", "data", "country_coords_cache.json")

def _load_coords_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def _save_coords_cache(data):
    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Error saving coords cache: {e}")

PERSISTENT_COORDS = _load_coords_cache()

@lru_cache(maxsize=200)
def get_country_coordinates(country_name):
    """
    Get (lat, lon) for a country.
    Uses cached list first, then persistent cache, then Photon API.
    """
    if country_name in COUNTRY_COORDS:
        return COUNTRY_COORDS[country_name]
    if country_name in PERSISTENT_COORDS:
        return PERSISTENT_COORDS[country_name]
    
    try:
        location = geolocator.geocode(country_name)
        if location:
            coords = (location.latitude, location.longitude)
            PERSISTENT_COORDS[country_name] = coords
            _save_coords_cache(PERSISTENT_COORDS)
            return coords
    except Exception as e:
        print(f"Geocoding error for {country_name}: {e}")
        return None
    return None

def calculate_distance(coord1, coord2):
    """Calculates distance in km between two (lat, lon) tuples."""
    if not coord1 or not coord2:
        return 0
    return geodesic(coord1, coord2).km

def analyze_route_options(from_country, to_country, distance_km):
    """
    Generates analysis for Air, Sea, and Road options using realistic logistics data.
    Returns a dict with details for each mode.
    """
    
    # 1. Determine Connectivity
    from_info = COUNTRY_LOGISTICS.get(from_country, {})
    to_info = COUNTRY_LOGISTICS.get(to_country, {})
    
    # Default to "Unknown" if not in DB, assuming standard access for fallback
    # But for strict checking, we can assume 'landlocked=False' if unknown to be safe, or True to be strict.
    # Let's assume unknown countries are NOT landlocked (have sea access) to avoid blocking too much,
    # unless we want strict "no fake data". User said "no fake data", so maybe default to strict?
    # If not in DB, we can't be sure. Let's try to infer or fallback to generous.
    # However, for "Continent", if unknown, we can't do road checks easily.
    
    # Logic:
    # Air: Always possible if distance > 0
    # Sea: Possible if NEITHER is landlocked.
    # Road: Possible if SAME continent OR (Europe AND Asia) OR (Asia AND Africa - via Suez? No, hard).
    #       Strictly: Same continent is safe bet. Europe-Asia is the main exception (Eurasia).
    
    modes = ['air']
    
    # --- SEA CHECK ---
    # Logic:
    # 1. If both countries are landlocked -> Sea is unlikely (would be River+Road+Sea+Road). Too complex. False.
    # 2. If distance is very short (< 500km) and Road is possible -> Prefer Road. Sea is inefficient.
    # 3. Otherwise, if at least one has sea access, we allow it (Multimodal for the landlocked one).
    
    from_landlocked = from_info.get('landlocked', False)
    to_landlocked = to_info.get('landlocked', False)
    
    sea_possible = True
    if from_landlocked and to_landlocked:
        sea_possible = False
    elif distance_km < 500:
        # Check if they are connected by land? 
        # If they are islands (e.g. UK to France), Sea is GOOD even for short distance.
        # But if France to Germany (<500), Sea is silly.
        pass # We'll refine this later with road check
        
    if sea_possible:
        modes.append('sea')
        
    # --- ROAD CHECK ---
    from_cont = from_info.get('continent', 'Unknown')
    to_cont = to_info.get('continent', 'Unknown')
    
    road_possible = False
    
    # 1. Check Island Constraints
    # If either is an island, Road is False, unless specific exception (bridge/tunnel)
    is_island_from = from_country in ISLAND_COUNTRIES
    is_island_to = to_country in ISLAND_COUNTRIES
    
    # Exception: UK is connected to Europe (Channel Tunnel)
    # But UK is in Europe continent in our DB usually.
    # Is UK an island in our list? No. 
    # Is Ireland? Yes.
    
    # Exception: UK <-> Ireland (Ferry is standard for trucks)
    if (from_country == "United Kingdom" and to_country == "Ireland") or \
       (from_country == "Ireland" and to_country == "United Kingdom"):
       road_possible = True
       
    # General Island Rule
    elif is_island_from or is_island_to:
        road_possible = False
        
    # 2. Continental Logic
    elif from_cont == to_cont and from_cont != 'Unknown':
        # Same continent
        road_possible = True
        
        # Exception: Darien Gap (North America <-> South America)
        # Wait, if they are same continent? 
        # Usually NA and SA are different continents in DB.
        # So this falls to else.
        
    else:
        # Cross-continent Road checks
        # Europe <-> Asia is connected
        if (from_cont == 'Europe' and to_cont == 'Asia') or (from_cont == 'Asia' and to_cont == 'Europe'):
            road_possible = True
            
        # Africa <-> Asia (Sinai)
        if (from_cont == 'Africa' and to_cont == 'Asia') or (from_cont == 'Asia' and to_cont == 'Africa'):
            # Allow for Egypt <-> Israel/Middle East
            road_possible = True
            
        # North America <-> South America -> BLOCKED (Darien Gap)
        # Even if someone says "Americas", physically no road.
        
    # 3. Refine Sea based on Road
    # If Road is possible and distance is short, remove Sea?
    # e.g. France -> Germany (Road=True, Dist=400km). Sea? No.
    if road_possible and distance_km < 800 and 'sea' in modes:
        # Unless it's an island crossing (where Road might mean Ferry, but pure Sea freight is also valid)
        # But usually for <800km inland, Sea is not used.
        if not is_island_from and not is_island_to:
             modes.remove('sea')

    # Hard distance limit for Road
    if road_possible and distance_km < 12000:
        modes.append('road')


    # Constants (Refined)
    SPEED = {
        'air': 850,
        'sea': 35,  # Modern container ships ~18-20 knots
        'road': 65
    }
    
    # Cost ($ per km per ton - refined)
    # Air is expensive. Sea is cheap. Road is middle.
    COST_RATE = {
        'air': 1.85,
        'sea': 0.12,
        'road': 0.45
    }
    
    # Handling/Processing Time (hours)
    # Sea takes long to load/unload
    HANDLING_TIME = {
        'air': 18,   # Customs + Loading
        'sea': 72,   # Port dwell time
        'road': 6    # Border crossings/loading
    }
    
    options = {}
    
    for mode in modes:
        travel_time_hours = distance_km / SPEED[mode]
        total_time_hours = travel_time_hours + HANDLING_TIME[mode]
        days = round(total_time_hours / 24, 1)
        
        # Cost Calculation
        # Base cost
        cost_usd = distance_km * COST_RATE[mode]
        
        # Add fixed costs (Terminal charges, documentation)
        fixed_cost = 500 if mode == 'air' else 1200 if mode == 'sea' else 200
        cost_usd += fixed_cost
        
        cost_usd = round(cost_usd, 2)
        
        base_risk = "Low"
        # Refined Risk Logic
        if mode == 'sea':
            if distance_km > 8000: base_risk = "Medium" # Long journey = more weather/delay risk
        if mode == 'road':
            if distance_km > 3000: base_risk = "Medium" # Long trucking = fatigue/breakdown/theft
            if distance_km > 8000: base_risk = "High"
            
        # Cost Breakdown Shares
        if mode == 'air':
            fuel_share = 0.45
            handling_share = 0.15
            insurance_share = 0.05
        elif mode == 'sea':
            fuel_share = 0.35
            handling_share = 0.25
            insurance_share = 0.10
        else: # road
            fuel_share = 0.40
            handling_share = 0.10
            insurance_share = 0.05
            
        risk_share = max(0.0, 1.0 - (fuel_share + handling_share + insurance_share))
        
        options[mode] = {
            "mode": mode.capitalize(),
            "distance_km": round(distance_km, 0),
            "estimated_days": days,
            "cost_usd": cost_usd,
            "base_risk": base_risk,
            "cost_breakdown": {
                "fuel": round(cost_usd * fuel_share, 2),
                "handling": round(cost_usd * handling_share, 2),
                "insurance": round(cost_usd * insurance_share, 2),
                "risk_premium": round(cost_usd * risk_share, 2),
            },
        }
        
    return options
