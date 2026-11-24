import os
import json
import random
import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

from src.utils import geo, finance, news_fetcher, risk_engine, weather

router = APIRouter(tags=["Dashboard Legacy Compatibility"])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ROUTES_DB_PATH = os.path.join(BASE_DIR, "src", "data", "routes_db.json")
REPORTS_DB_PATH = os.path.join(BASE_DIR, "src", "data", "reports_db.json")
ASSETS_DIR = os.path.join(BASE_DIR, "assets")


def _load_json_file(path: str) -> Any:
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except Exception:
        return []


def _save_json_file(path: str, data: Any) -> bool:
    try:
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(data, handle, indent=2)
        return True
    except Exception:
        return False


def _load_routes_data() -> List[Dict[str, Any]]:
    if os.path.exists(ROUTES_DB_PATH):
        return _load_json_file(ROUTES_DB_PATH)
    return []


def _save_routes_data(routes: list) -> bool:
    return _save_json_file(ROUTES_DB_PATH, routes)


def _load_reports_data() -> List[Dict[str, Any]]:
    if os.path.exists(REPORTS_DB_PATH):
        return _load_json_file(REPORTS_DB_PATH)
    return []


def _save_reports_data(reports: list) -> bool:
    return _save_json_file(REPORTS_DB_PATH, reports)


@router.get("/api/countries")
def api_countries():
    return geo.get_all_countries()


@router.get("/api/route-options")
def api_route_options(request: Request):
    origin = request.query_params.get("from", "India")
    dest = request.query_params.get("to", "Netherlands")
    coords1 = geo.get_country_coordinates(origin)
    coords2 = geo.get_country_coordinates(dest)
    if not coords1 or not coords2:
        return {"error": "Could not locate countries"}
    dist = geo.calculate_distance(coords1, coords2)
    opts = geo.analyze_route_options(origin, dest, dist)
    routes_list = []
    for mode_key, data in opts.items():
        route_id = f"{mode_key}-{origin[:3]}-{dest[:3]}".upper()
        routes_list.append({
            "id": route_id,
            "mode": data["mode"],
            "name": f"{data['mode']} Freight",
            "details": f"Via {origin} - {dest} Corridor",
            "risk_score": 3.4,
            "cost_usd": data["cost_usd"],
            "transit_time": data["estimated_days"],
            "cost_index": 2,
            "primary_risk": "Weather / Monsoon" if mode_key == "sea" else "Fuel Costs",
            "reliability": "High",
            "feasibility": "High"
        })
    return {
        "origin": origin,
        "destination": dest,
        "distance_km": round(dist, 0),
        "ai_suggestions": ["Regional connectivity is strong."],
        "recommendation": {
            "id": routes_list[0]["id"] if routes_list else "",
            "reasoning": "Optimal balance of transit time and logistics freight."
        },
        "routes": routes_list
    }


@router.get("/api/fuel-benchmarks")
@router.get("/api/fuels")
def api_fuel_benchmarks(refresh: bool = False):
    from src.utils import fuel_engine
    return fuel_engine.get_fuel_benchmarks(force_refresh=refresh)


@router.get("/api/routes")
def get_routes(request: Request):
    routes = _load_routes_data()
    route_type = request.query_params.get("type")
    if route_type:
        routes = [r for r in routes if r.get("type") == route_type]

    enriched = []
    for r in routes:
        rc = r.copy()
        c_from = rc.get("from")
        c_to = rc.get("to")
        if c_from and c_to:
            s_coords = geo.get_country_coordinates(c_from)
            e_coords = geo.get_country_coordinates(c_to)
            if s_coords and e_coords:
                rc["startLat"] = s_coords[0]
                rc["startLng"] = s_coords[1]
                rc["endLat"] = e_coords[0]
                rc["endLng"] = e_coords[1]
        enriched.append(rc)
    return enriched


@router.post("/api/routes")
async def create_route(request: Request):
    try:
        data = await request.json()
    except Exception:
        data = {}
    routes = _load_routes_data()
    if "id" not in data:
        data["id"] = f"r{len(routes)+1}_{int(datetime.datetime.now().timestamp())}"
    data.setdefault("type", "active")
    data.setdefault("status", "Planned")
    data.setdefault("risk_score", 3.0)
    data.setdefault("risk_delta", 0.0)
    data.setdefault("last_updated", datetime.datetime.now().isoformat())
    routes.append(data)
    _save_routes_data(routes)
    return data


@router.put("/api/routes/{route_id}")
async def update_route(route_id: str, request: Request):
    routes = _load_routes_data()
    idx = next((i for i, r in enumerate(routes) if str(r.get("id")) == str(route_id)), -1)
    if idx == -1:
        raise HTTPException(status_code=404, detail="Route not found")
    data = await request.json()
    routes[idx].update(data)
    routes[idx]["last_updated"] = datetime.datetime.now().isoformat()
    _save_routes_data(routes)
    return routes[idx]


@router.delete("/api/routes/{route_id}")
def delete_route(route_id: str):
    routes = _load_routes_data()
    idx = next((i for i, r in enumerate(routes) if str(r.get("id")) == str(route_id)), -1)
    if idx == -1:
        raise HTTPException(status_code=404, detail="Route not found")
    deleted = routes.pop(idx)
    _save_routes_data(routes)
    return deleted


@router.get("/api/news")
def get_news(request: Request):
    route_name = request.query_params.get("route", "")
    location = request.query_params.get("location", "")
    base_news = [
        {
            "title": "Maharashtra Monsoon Logistics: Western Ghat Corridors Operating with Caution",
            "summary": "NH-48 Khandala Ghat freight speed reduced; regional FMCG depots deploy buffer stocks.",
            "source": "FlowGrid Logistics Wire",
            "pubDate": datetime.date.today().isoformat()
        },
        {
            "title": "Bhiwandi Central Mega Depot Dispatches Expiry-Aware Batches",
            "summary": "Fast-moving edible oils and staples prioritized for Kirana retail endpoints.",
            "source": "FMCG Daily",
            "pubDate": datetime.date.today().isoformat()
        }
    ]
    return base_news


@router.get("/api/ports/{country}")
def get_ports(country: str):
    return geo.get_ports_for_country(country)


@router.post("/api/analyze-shipment")
async def analyze_shipment(request: Request):
    try:
        data = await request.json()
    except Exception:
        data = {}
    from_country = data.get("from_country", "India")
    to_country = data.get("to_country", "Netherlands")
    currency = data.get("currency", "USD")

    if not from_country or not to_country:
        return JSONResponse(status_code=400, content={"error": "Missing origin or destination"})

    if str(from_country).strip().lower() == str(to_country).strip().lower():
        return JSONResponse(status_code=400, content={"error": "Origin and destination countries cannot be identical"})

    coord1 = geo.get_country_coordinates(from_country)
    coord2 = geo.get_country_coordinates(to_country)
    if not coord1 or not coord2:
        return JSONResponse(status_code=404, content={"error": f"Could not geocode locations for {from_country} or {to_country}"})

    dist = geo.calculate_distance(coord1, coord2)
    analysis = geo.analyze_route_options(from_country, to_country, dist)
    feasibility = geo.check_mode_feasibility(from_country, to_country, dist)
    rates = finance.get_exchange_rates()

    from src.utils.routing_weight_engine import routing_weight_engine
    routing_weights = routing_weight_engine.compute_routing_weights(from_country, to_country)

    for mode, details in analysis.items():
        details['cost'] = finance.convert_currency(details['cost_usd'], "USD", currency, rates)
        details['currency'] = currency

    sanctions_val = 9.8 if routing_weights.get("sanctions_weight", 0.0) >= 0.8 else 1.0
    combined_risk = "High" if sanctions_val >= 9.0 else "Low"

    return {
        "from": from_country,
        "to": to_country,
        "coordinates": {"start": coord1, "end": coord2},
        "distance_km": dist,
        "analysis": analysis,
        "feasibility": feasibility,
        "risk_summary": {
            "origin_score": 9.2 if sanctions_val >= 9.0 else 2.8,
            "destination_score": 9.0 if sanctions_val >= 9.0 else 2.5,
            "combined_level": combined_risk,
            "reasons": routing_weights.get("key_points", ["Baseline corridor connectivity validated."])
        },
        "risk_drivers": {
            "fuel": {"val": 4.5, "label": "Fuel Volatility"},
            "politics": {"val": 3.0, "label": "Political Stability"},
            "labor": {"val": 2.5, "label": "Labor & Strikes"},
            "sanctions": {"val": sanctions_val, "label": "Sanctions & Compliance"}
        },
        "routing_weights": routing_weights,
        "routing_key_points": routing_weights.get("key_points", []),
        "validation_source": "Google News RSS & routing_data.json Key-Points Telemetry"
    }


@router.api_route("/api/mode-feasibility", methods=["GET", "POST"])
async def mode_feasibility_api(request: Request):
    if request.method == "POST":
        try:
            data = await request.json()
        except Exception:
            data = {}
        from_country = data.get("from_country", "India")
        to_country = data.get("to_country", "Netherlands")
        preferred_mode = data.get("preferred_mode")
    else:
        params = request.query_params
        from_country = params.get("from", "India")
        to_country = params.get("to", "Netherlands")
        preferred_mode = params.get("mode")

    coord1 = geo.get_country_coordinates(from_country) or (20.59, 78.96)
    coord2 = geo.get_country_coordinates(to_country) or (52.13, 5.29)
    dist = geo.calculate_distance(coord1, coord2)
    feasibility = geo.check_mode_feasibility(from_country, to_country, dist)
    analysis = geo.analyze_route_options(from_country, to_country, dist)

    is_feasible = True
    if preferred_mode and preferred_mode in feasibility:
        is_feasible = feasibility[preferred_mode]["feasible"]

    return {
        "from": from_country,
        "to": to_country,
        "distance_km": dist,
        "coordinates": {"start": coord1, "end": coord2},
        "feasibility": feasibility,
        "analysis": analysis,
        "selected_mode": preferred_mode,
        "selected_feasible": is_feasible
    }


@router.get("/api/reports-summary")
def get_reports_summary():
    return {
        "summary": "Network health is optimal. Active corridors operating within safe risk thresholds.",
        "why": "Continuous monitoring of regional depots, Western Ghat routes, and Days of Supply."
    }


@router.get("/api/reports-history")
def get_reports_history():
    reports = _load_reports_data()
    return reports


@router.post("/api/generate-report")
async def generate_report(request: Request):
    try:
        data = await request.json()
    except Exception:
        data = {}
    report_type = data.get("type", "executive_brief")
    now = datetime.datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    name = f"Report_{report_type}_{date_str}"
    new_report = {
        "id": f"rep_{int(now.timestamp())}",
        "name": name,
        "type": "PDF",
        "date": date_str,
        "version": "v2.0",
        "status": "Ready",
        "integrity": "Verified source",
        "generated_by": "System User",
        "download_url": f"/assets/reports/{name}.pdf"
    }
    reports = _load_reports_data()
    reports.insert(0, new_report)
    _save_reports_data(reports)
    return new_report


@router.post("/api/route-risk")
async def route_risk_api(request: Request):
    try:
        data = await request.json()
    except Exception:
        data = {}
    location = str(data.get("location", "")).strip() or "Maharashtra"
    return {
        "score": 3.5,
        "riskLevel": "Low",
        "risk_level": "Low",
        "recommendation": "Maintain scheduled replenishment.",
        "justification": ["Road conditions are stable", "Fuel surcharges within standard limits"],
        "formatted": "Route Score: 3.5/10\nRisk Level: Low\nRecommendation: Normal Dispatch"
    }


@router.get("/api/risk-history")
def get_risk_history():
    today = datetime.date.today()
    history = []
    base = 3.5
    for i in range(30, 0, -1):
        dt = (today - datetime.timedelta(days=i)).strftime("%Y-%m-%d")
        history.append({
            "date": dt,
            "score": round(base + random.uniform(-0.5, 0.5), 1)
        })
    return history


@router.get("/api/risk-breakdown")
def get_risk_breakdown():
    return {
        "fuel": 3.2,
        "labor": 2.1,
        "politics": 1.5,
        "sanctions": 1.2,
        "weather": 4.1
    }
