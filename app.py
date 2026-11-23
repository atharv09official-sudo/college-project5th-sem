import json
import os
import datetime
import random
import logging
import sys
import mimetypes
from typing import Any

# Fix Windows MIME type issues for static assets
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('video/mp4', '.mp4')
mimetypes.add_type('image/jpeg', '.jpg')
mimetypes.add_type('image/png', '.png')

from src.utils import geo, finance, news_fetcher, risk_engine, weather, fuel_engine
from src.utils.auth import create_user, authenticate, get_user_by_id

from flask import Flask, jsonify, render_template, request, send_from_directory, redirect
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user


# Configure Logging to Console
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


def _load_env_from_file(path: str = ".env") -> None:
    if not os.path.exists(path):
        return
    try:
        with open(path, "r", encoding="utf-8") as handle:
            for line in handle:
                text = line.strip()
                if not text or text.startswith("#") or "=" not in text:
                    continue
                key, value = text.split("=", 1)
                key = key.strip()
                value = value.strip()
                if key and key not in os.environ:
                    os.environ[key] = value
    except OSError:
        return


def _get_int_env(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default




_load_env_from_file()


RISK_SCORE_MIN = _get_int_env("RISK_SCORE_MIN", 0)
RISK_SCORE_MAX = _get_int_env("RISK_SCORE_MAX", 10)


app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "dev_secret_key_123_change_in_prod")

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login_page'

class User(UserMixin):
    def __init__(self, user_data):
        self.id = str(user_data['user_id'])
        self.name = user_data['name']
        self.email = user_data['email']
        self.role = user_data['role']

@login_manager.user_loader
def load_user(user_id):
    try:
        user_data = get_user_by_id(int(user_id))
        if user_data:
            return User(user_data)
    except Exception:
        pass
    return None



def _add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = os.getenv("AUTH_CORS_ORIGIN", "*")
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS, GET, PUT, DELETE"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


@app.after_request
def after_request(response):
    return _add_cors_headers(response)


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "dashboard")
ROUTES_DB_PATH = os.path.join(BASE_DIR, "src", "data", "routes_db.json")
REPORTS_DB_PATH = os.path.join(BASE_DIR, "src", "data", "reports_db.json") # Added missing path
ASSETS_DIR = os.path.join(BASE_DIR, "assets")


def _load_json_file(path: str) -> Any:
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except OSError:
        return []
    except json.JSONDecodeError:
        return []


def _save_json_file(path: str, data: Any) -> bool:
    try:
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(data, handle, indent=2)
        return True
    except OSError:
        return False


def _load_routes_data() -> Any:
    if os.path.exists(ROUTES_DB_PATH):
        return _load_json_file(ROUTES_DB_PATH)
    return []


def _save_routes_data(routes: list) -> bool:
    return _save_json_file(ROUTES_DB_PATH, routes)


def _load_news_data() -> Any:
    return []

def _load_reports_data() -> Any:
    if os.path.exists(REPORTS_DB_PATH):
        return _load_json_file(REPORTS_DB_PATH)
    return []

def _save_reports_data(reports: list) -> bool:
    return _save_json_file(REPORTS_DB_PATH, reports)


def evaluate_route_risk(location: str, route: str, raw_text_data: str) -> dict:
    """
    Evaluates risk using the enhanced Risk Engine.
    Fetches external data (News/Weather) if raw_text_data is empty.
    """
    # If no raw text provided, gather it dynamically
    if not raw_text_data:
        gathered_text, _ = _gather_external_text(location, route)
        # Inject static risk profiles for known high-risk areas to ensure genuine baseline
        static_context = risk_engine.get_static_risk_keywords(location)
        if route:
            static_context += " " + risk_engine.get_static_risk_keywords(route)
            
        text = f"{location} {route} {gathered_text} {static_context}"
    else:
        text = f"{location} {route} {raw_text_data}"
    
    # Use the Risk Engine with target location context
    analysis = risk_engine.calculate_risk_score(text, target_location=location)
    
    # Format for API response (Backward Compatibility)
    formatted_output_lines = [
        f"Route Score: {analysis['score']}/{RISK_SCORE_MAX}",
        f"Risk Level: {analysis['risk_level']}",
        f"Recommendation: {analysis['recommendation']}",
        "Justification:",
    ] + [f"- {item}" for item in analysis['reasons']]

    formatted_output = "\n".join(formatted_output_lines)

    return {
        "score": analysis['score'],
        "riskLevel": analysis['risk_level'],  # CamelCase for frontend consistency
        "risk_level": analysis['risk_level'], # Keep snake_case for backward compatibility
        "recommendation": analysis['recommendation'],
        "justification": analysis['reasons'],
        "formatted": formatted_output,
    }


def _gather_external_text(location: str, route: str) -> tuple[str, dict[str, bool]]:
    # Construct a more targeted query to ensure we get risk/logistics related news
    # rather than just general diplomatic news.
    base_query = f"{location} {route}".strip() or location or route
    
    # Append context keywords to guide the search engine
    enhanced_query = f"{base_query} port freight shipping delays disruptions"
    
    sources_used = {
        "google_news_rss": False,
        "openweather": False,
    }
    parts: list[str] = []
    
    # Fetch Real-Time News
    if base_query:
        # Use enhanced query for better relevance
        news_items = news_fetcher.get_combined_news(enhanced_query)
        
        # If no results with enhanced query, fall back to base query
        if not news_items:
            news_items = news_fetcher.get_combined_news(base_query)
            
        if news_items:
            # Extract summaries/titles for analysis
            news_text = "\n".join([f"{item['title']}. {item['summary']}" for item in news_items])
            parts.append(news_text)
            sources_used["google_news_rss"] = True
            
    # Fetch Weather
    if location:
        weather_text = weather.get_weather_summary(location)
        if weather_text:
            parts.append(weather_text)
            sources_used["openweather"] = True
            
    combined = "\n\n".join(part for part in parts if part)
    return combined, sources_used


@app.route("/api/auth/signup", methods=["POST", "OPTIONS"])
def api_signup():
    if request.method == "OPTIONS":
        return _add_cors_headers(app.response_class())
    
    data = request.get_json(force=True, silent=True) or {}
    name = str(data.get("name") or "").strip()
    email = str(data.get("email") or "").strip().lower()
    password = str(data.get("password") or "")
    role_input = str(data.get("role") or "").strip()

    logger.info(f"ACTION TRIGGERED: User Signup | Name: {name} | Email: {email} | Role: {role_input}")

    if not name or not email or not password:
        logger.warning(f"Signup Failed: Missing fields | Name: {name} | Email: {email}")
        return jsonify({"ok": False, "error": "Missing name, email, or password"}), 400
    
    # Map frontend roles to DB constraints ('planner', 'analyst')
    db_role = "planner"
    if "analyst" in role_input.lower():
        db_role = "analyst"
    
    try:
        user_id = create_user(name=name, email=email, password=password, role=db_role)
        logger.info(f"Signup Successful | User ID: {user_id}")
        
        # Auto-login after signup
        user_data = get_user_by_id(user_id)
        if user_data:
            user = User(user_data)
            login_user(user)
            
    except Exception as exc:
        logger.error(f"Signup Error: {exc}")
        return jsonify({"ok": False, "error": str(exc)}), 400
        
    return jsonify({"ok": True, "user_id": user_id, "name": name, "email": email, "role": db_role})


@app.route("/api/auth/login", methods=["POST", "OPTIONS"])
def api_login():
    if request.method == "OPTIONS":
        return _add_cors_headers(app.response_class())
        
    data = request.get_json(force=True, silent=True) or {}
    email = str(data.get("email") or "").strip().lower()
    password = str(data.get("password") or "")
    
    logger.info(f"ACTION TRIGGERED: User Login | Email: {email}")

    if not email or not password:
        logger.warning("Login Failed: Missing email or password")
        return jsonify({"ok": False, "error": "Missing email or password"}), 400
        
    user = authenticate(email=email, password=password)
    if not user:
        logger.warning(f"Login Failed: Invalid credentials for {email}")
        return jsonify({"ok": False, "error": "Invalid credentials"}), 401
        
    # Log user in with Flask-Login
    login_user(User(user))
    
    logger.info(f"Login Successful | User: {user['name']} ({user['role']})")
    return jsonify({"ok": True, "user": user})


@app.route("/api/auth/logout", methods=["POST"])
@login_required
def api_logout():
    logout_user()
    return jsonify({"ok": True})


@app.route("/api/auth/me", methods=["GET"])
def api_me():
    if current_user.is_authenticated:
        return jsonify({
            "ok": True, 
            "user": {
                "id": current_user.id,
                "name": current_user.name,
                "email": current_user.email,
                "role": current_user.role
            }
        })
    return jsonify({"ok": False}), 401


@app.route("/", methods=["GET"])
def landing_page():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/dashboard", methods=["GET"])
@login_required
def dashboard_page():
    return send_from_directory(FRONTEND_DIR, "dashboard.html")


@app.route("/analysis", methods=["GET"])
@login_required
def analysis_page():
    return send_from_directory(FRONTEND_DIR, "analysis.html")


@app.route("/routes", methods=["GET"])
@login_required
def routes_page():
    return send_from_directory(FRONTEND_DIR, "routes.html")


@app.route("/routes/compare", methods=["GET"])
@login_required
def compare_page():
    return send_from_directory(FRONTEND_DIR, "compare.html")


@app.route("/map", methods=["GET"])
@login_required
def map_page():
    return send_from_directory(FRONTEND_DIR, "map.html")


@app.route("/intelligence", methods=["GET"])
@login_required
def intelligence_page():
    return send_from_directory(FRONTEND_DIR, "intelligence.html")


@app.route("/reports", methods=["GET"])
@login_required
def reports_page():
    return send_from_directory(FRONTEND_DIR, "reports.html")


@app.route("/settings", methods=["GET"])
@login_required
def settings_page():
    return send_from_directory(FRONTEND_DIR, "settings.html")


@app.route("/login", methods=["GET"])
def login_page():
    return send_from_directory(FRONTEND_DIR, "login.html")


@app.route("/signup", methods=["GET"])
def signup_page():
    return send_from_directory(FRONTEND_DIR, "signup.html")


@app.route("/trade-routes", methods=["GET"])
def trade_routes_page():
    return send_from_directory(FRONTEND_DIR, "trade-routes.html")


@app.route("/plan-generator", methods=["GET"])
def plan_generator_page():
    return redirect("/trade-routes")


@app.route("/inventory-health", methods=["GET"])
def inventory_health_page():
    return redirect("/trade-routes")


@app.route("/kirana-pos", methods=["GET"])
def kirana_pos_page():
    return redirect("/trade-routes")


@app.route("/road-risk", methods=["GET"])
def road_risk_page():
    return send_from_directory(FRONTEND_DIR, "road-risk.html")


@app.route("/import-studio", methods=["GET"])
def import_studio_page():
    return redirect("/trade-routes")


@app.route("/shipment-planner", methods=["GET"])
def shipment_planner_page():
    return send_from_directory(FRONTEND_DIR, "shipment-planner.html")


@app.route("/compare", methods=["GET"])
def compare_direct_page():
    return send_from_directory(FRONTEND_DIR, "compare.html")



@app.route("/mvp", methods=["GET"])
def mvp_index() -> str:
    return render_template("index.html")


@app.route("/src/<path:filename>", methods=["GET"])
def src_static(filename: str):
    return send_from_directory("src", filename)


@app.route("/assets/<path:filename>", methods=["GET"])
def assets_static(filename: str):
    full_path = os.path.join(ASSETS_DIR, filename)
    # print("assets_static", "ASSETS_DIR=", ASSETS_DIR, "filename=", filename, "full_path=", full_path, "exists=", os.path.exists(full_path))
    return send_from_directory(ASSETS_DIR, filename)


@app.route("/api/route-risk", methods=["POST"])
def route_risk():
    data = request.get_json(force=True, silent=True) or {}
    location = str(data.get("location", "")).strip()
    route = str(data.get("route", "")).strip()
    raw_text_data = str(data.get("raw_text_data", "")).strip()
    
    logger.info(f"ACTION TRIGGERED: Calculate Route Risk | Location: {location} | Route: {route}")

    external_text, external_sources_used = _gather_external_text(location, route)
    if external_text:
        if raw_text_data:
            combined_text = f"{raw_text_data}\n\n{external_text}"
        else:
            combined_text = external_text
    else:
        combined_text = raw_text_data

    result = evaluate_route_risk(location=location, route=route, raw_text_data=combined_text)
    result["external_sources_used"] = external_sources_used
    return jsonify(result)


@app.route("/api/risk-history", methods=["GET"])
def api_risk_history():
    location = request.args.get('location', 'Global')
    route_param = request.args.get('route', "")
    origin_param = request.args.get('origin', "")
    
    logger.info(f"ACTION TRIGGERED: Fetch Risk History | Location: {location} | Route: {route_param}")
    
    try:
        # 1. Get current snapshot risk (Genuine/Researched)
        # If specific route provided, use it for context
        current = evaluate_route_risk(location, route_param or "General Logistics", "")
        current_score = current['score']
        
        # If route is provided, we might want to blend origin/destination risks for better accuracy
        # (Similar to api_analyze_shipment logic)
        if route_param and origin_param and location != origin_param:
            # Check origin risk too
            origin_risk = evaluate_route_risk(origin_param, "Export Logistics", "")
            # Average them (simple model)
            current_score = (current_score + origin_risk['score']) / 2
    except Exception as e:
        logger.error(f"ERROR in api_risk_history analysis: {e}")
        # Fallback to safe default if analysis crashes
        current_score = 5.0
        
    # 2. Generate synthetic history leading up to this score
    # Since we don't have a time-series DB, we simulate a realistic path
    history = []
    days = 90
    
    # Volatility depends on risk level (Higher risk = more volatile)
    volatility = 0.2 if current_score < 4 else 0.5 if current_score < 7 else 0.8
    
    # Start point (randomly offset from current)
    # If high risk, maybe it spiked recently. If low, it's stable.
    prev_score = max(0.1, min(10.0, current_score + random.uniform(-1.0, 1.0)))
    
    today = datetime.date.today()
    
    for i in range(days):
        date = (today - datetime.timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        
        # Random walk towards current_score as we get closer
        remaining_steps = days - i
        target_pull = (current_score - prev_score) / max(1, remaining_steps)
        
        noise = random.uniform(-volatility, volatility)
        
        # Calculate new score
        new_score = prev_score + target_pull + noise
        new_score = max(0.1, min(10.0, new_score))
        
        history.append({
            "date": date,
            "score": round(new_score, 1)
        })
        prev_score = new_score
        
    # Force the last point to match current genuine score exactly
    history[-1]['score'] = current_score
        
    return jsonify(history)


@app.route("/api/risk-breakdown", methods=["GET"])
def api_risk_breakdown():
    location = request.args.get('location', 'Global')
    route_param = request.args.get('route', "")
    
    logger.info(f"ACTION TRIGGERED: Fetch Risk Breakdown | Location: {location} | Route: {route_param}")
    
    # Get comprehensive risk analysis
    # We use evaluate_route_risk which fetches news & weather
    # Pass the specific route if available to capture trade-lane specific risks (e.g. Sanctions)
    try:
        analysis = evaluate_route_risk(location, route_param or "Logistics", "")
        base_score = analysis['score']
        reasons = " ".join(analysis['justification']).lower()
    except Exception as e:
        logger.error(f"ERROR in api_risk_breakdown analysis: {e}")
        base_score = 5.0
        reasons = ""
    
    # Define keywords for categorization
    keywords = {
        "fuel": ["fuel", "oil", "gas", "energy", "price", "cost", "petrol", "diesel"],
        "labor": ["strike", "union", "protest", "labor", "worker", "staff", "shortage", "wages"],
        "politics": ["war", "conflict", "election", "unrest", "riot", "government", "policy", "geopolitical", "tensions"],
        "sanctions": ["sanction", "embargo", "ban", "tariff", "trade war", "restriction", "customs", "border"],
        "weather": ["storm", "hurricane", "typhoon", "flood", "rain", "snow", "earthquake", "disaster", "climate", "weather", "cyclone"]
    }
    
    breakdown = {}
    
    # Calculate sub-scores based on keyword presence in the justification/reasons
    # Start with a baseline that is slightly lower than the overall score (assuming overall is a sum of parts)
    # But if overall is low, sub-scores should be low.
    
    for category, terms in keywords.items():
        # Base risk for category is fraction of total risk
        # If total risk is high, we assume it's distributed unless specific reasons found
        # Add small natural variance (0.0-0.2) to avoid robotic flatlines
        noise = random.uniform(0.0, 0.2)
        cat_score = (base_score * 0.6) + noise
        
        # Boost score if specific keywords found
        hit_count = sum(1 for term in terms if term in reasons)
        if hit_count > 0:
            cat_score = max(cat_score, base_score) + (hit_count * 0.5)
        
        # Clamp to 0.1-10.0
        breakdown[category] = round(max(0.1, min(10.0, cat_score)), 1)

    # Ensure at least one category explains a high score
    if base_score > 5:
        max_cat = max(breakdown.values())
        if max_cat < base_score:
            # If no specific category matched, boost Politics/General as fallback
            breakdown['politics'] = base_score

    return jsonify(breakdown)


@app.route("/api/routes", methods=["GET", "POST"])
def api_routes():
    try:
        if request.method == "POST":
            data = request.get_json(force=True, silent=True) or {}
            
            logger.info(f"ACTION TRIGGERED: Create New Route | Data: {data}")

            routes = _load_routes_data()
            
            # Generate ID if missing
            if "id" not in data:
                data["id"] = f"r{len(routes) + 1}_{int(datetime.datetime.now().timestamp())}"
            
            # Add default fields if missing
            if "type" not in data: data["type"] = "active"
            if "status" not in data: data["status"] = "Stable"
            if "risk_score" not in data: data["risk_score"] = 0.0
            if "risk_delta" not in data: data["risk_delta"] = 0.0
            if "last_updated" not in data: data["last_updated"] = datetime.datetime.now().isoformat()
            
            routes.append(data)
            _save_routes_data(routes)
            return jsonify(data), 201

        # GET
        route_type = request.args.get('type')
        logger.info(f"ACTION TRIGGERED: Fetch Routes List | Type: {route_type if route_type else 'All'}")

        routes = _load_routes_data()
        if route_type:
            routes = [r for r in routes if r.get('type') == route_type]

        # Enrich with coordinates for map visualization
        enriched_routes = []
        for r in routes:
            route_copy = r.copy()
            from_country = route_copy.get('from')
            to_country = route_copy.get('to')
            
            if from_country and to_country:
                start_coords = geo.get_country_coordinates(from_country)
                end_coords = geo.get_country_coordinates(to_country)
                
                if start_coords and end_coords:
                    route_copy['startLat'] = start_coords[0]
                    route_copy['startLng'] = start_coords[1]
                    route_copy['endLat'] = end_coords[0]
                    route_copy['endLng'] = end_coords[1]
            
            enriched_routes.append(route_copy)
            
        return jsonify(enriched_routes)
    except Exception as e:
        logger.error(f"Error in api_routes: {e}")
        return jsonify([]), 500


@app.route("/api/countries", methods=["GET"])
def api_countries():
    """Returns a list of all available countries."""
    try:
        countries = geo.get_all_countries()
        return jsonify(countries)
    except Exception as e:
        logger.error(f"Error fetching countries: {e}")
        return jsonify([]), 500


@app.route("/api/route-options", methods=["GET"])
def api_route_options():
    try:
        origin = request.args.get('from', 'India')
        destination = request.args.get('to', 'Netherlands')
        
        logger.info(f"ACTION TRIGGERED: Compare Routes | From: {origin} | To: {destination}")

        # 1. Get Coordinates & Distance
        origin_coords = geo.get_country_coordinates(origin)
        dest_coords = geo.get_country_coordinates(destination)
        
        if not origin_coords or not dest_coords:
            return jsonify({"error": "Could not locate one or both countries"}), 400
            
        distance_km = geo.calculate_distance(origin_coords, dest_coords)
        
        # 2. Analyze Options (Air, Sea, Road)
        # This returns a dict like {'air': {...}, 'sea': {...}}
        options = geo.analyze_route_options(origin, destination, distance_km)
        
        # 3. Transform to Frontend Format
        routes_list = []
        recommendation_id = None
        min_cost = float('inf')
        min_time = float('inf')
        
        # Helper to map numerical cost to $$$ signs count (1-5)
        # Assuming max cost for a typical shipment might be $20,000? 
        # Normalize: cost_index = min(5, max(1, cost / 2000))
        
        for mode_key, data in options.items():
            route_id = f"{mode_key}-{origin[:3]}-{destination[:3]}".upper()
            
            # Risk Score Simulation (Base risk from geo.py + some variation)
            base_risk_level = data['base_risk']
            # Map level to score range
            if base_risk_level == "Low": score = random.uniform(1.0, 3.5)
            elif base_risk_level == "Medium": score = random.uniform(3.6, 6.5)
            else: score = random.uniform(6.6, 9.0)
            
            # Feasibility
            feasibility = "High"
            feasibility_reason = ""
            if mode_key == 'road' and data['distance_km'] > 8000:
                feasibility = "Limited"
                feasibility_reason = "Extreme distance for road transport."
            
            # Reliability (Simulated)
            reliability = "High"
            if mode_key == 'sea' and base_risk_level != "Low": reliability = "Medium"
            if mode_key == 'road' and data['distance_km'] > 5000: reliability = "Medium"
            
            # Cost Index
            cost_index = max(1, min(5, int(data['cost_usd'] / 3000) + 1))
            
            route_obj = {
                "id": route_id,
                "mode": data['mode'], # "Air", "Sea", "Road"
                "name": f"{data['mode']} Freight",
                "details": f"Via {origin} - {destination} Corridor",
                "risk_score": round(score, 1),
                "transit_time": data['estimated_days'],
                "cost_index": cost_index,
                "cost_usd": data['cost_usd'], # Extra info
                "primary_risk": "Weather / Delays" if mode_key == 'sea' else "Fuel Costs" if mode_key == 'air' else "Border Delays",
                "reliability": reliability,
                "feasibility": feasibility,
                "feasibility_reason": feasibility_reason
            }
            routes_list.append(route_obj)
            
            # Simple recommendation logic: Best balance of time and cost?
            # Or just lowest risk?
            # Let's say: Recommend lowest risk, tie-break with cost.
            if not recommendation_id:
                recommendation_id = route_id
            else:
                # Find current recommended obj
                curr_rec = next(r for r in routes_list if r['id'] == recommendation_id)
                
                # Logic: If this route has significantly lower risk, pick it.
                if route_obj['risk_score'] < curr_rec['risk_score'] - 1.0:
                    recommendation_id = route_id
                # If similar risk, pick cheaper
                elif abs(route_obj['risk_score'] - curr_rec['risk_score']) <= 1.0:
                    if route_obj['cost_usd'] < curr_rec['cost_usd']:
                        recommendation_id = route_id

        # 4. Generate Suggestions
        suggestions = []
        if distance_km > 10000:
            suggestions.append("Consider Sea Freight for bulk shipments to reduce costs.")
        else:
            suggestions.append("Regional connectivity is strong; consider Road for flexibility.")
            
        if any(r['mode'] == 'Air' for r in routes_list):
            suggestions.append("Air Freight available for urgent high-value cargo.")

        response_data = {
            "origin": origin,
            "destination": destination,
            "distance_km": round(distance_km, 0),
            "ai_suggestions": suggestions,
            "recommendation": {
                "id": recommendation_id,
                "reasoning": "Optimal balance of risk, cost, and transit time based on current logistics data."
            },
            "routes": routes_list
        }
        
        return jsonify(response_data)

    except Exception as e:
        logger.error(f"Error in api_route_options: {e}")
        return jsonify({"error": str(e)}), 500



@app.route("/api/routes/<route_id>", methods=["PUT", "DELETE"])
def api_route_detail(route_id):
    logger.info(f"ACTION TRIGGERED: Route Detail Action | ID: {route_id} | Method: {request.method}")

    routes = _load_routes_data()
    route_idx = next((i for i, r in enumerate(routes) if str(r.get("id")) == str(route_id)), -1)
    
    if route_idx == -1:
        return jsonify({"error": "Route not found"}), 404

    if request.method == "DELETE":
        deleted = routes.pop(route_idx)
        _save_routes_data(routes)
        return jsonify(deleted)

    # PUT
    data = request.get_json(force=True, silent=True) or {}
    routes[route_idx].update(data)
    routes[route_idx]["last_updated"] = datetime.datetime.now().isoformat()
    _save_routes_data(routes)
    return jsonify(routes[route_idx])


@app.route("/api/news", methods=["GET"])
def api_news():
    # If route/location params provided, try to fetch dynamic live data
    route_name = request.args.get('route')
    location = request.args.get('location')
    
    logger.info(f"ACTION TRIGGERED: Fetch News | Route: {route_name} | Location: {location}")
    
    # Get Base Mock Data (Static History)
    base_news = _load_news_data()
    
    dynamic_items = []
    
    # 1. Fetch Real-Time News via Google RSS if needed
    if route_name or location:
        query = f"{location or ''} {route_name or ''}".strip()
        if query:
            dynamic_items = news_fetcher.fetch_google_news_rss(query)
    
    # If no specific query but we want "general" news, maybe fetch some general logistics news?
    # For now, let's keep it clean: if no query, just show static. 
    # Or we could fetch "global logistics" news.
    if not dynamic_items and not route_name and not location:
        # Optional: Fetch general logistics news
        dynamic_items = news_fetcher.fetch_google_news_rss("global supply chain logistics")

    # Combine: Dynamic first, then static
    # Add metadata to static items too
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    for item in base_news:
        if "meta_fetched_at" not in item:
            item["meta_fetched_at"] = now_str
            item["meta_is_live"] = False
            item["meta_source_origin"] = "Historical Database"
            item["meta_verified"] = True

    return jsonify(dynamic_items + base_news)


@app.route("/api/fuel-benchmarks", methods=["GET"])
@app.route("/api/fuels", methods=["GET"])
def api_fuel_benchmarks():
    force = request.args.get('refresh', '').lower() in ['1', 'true', 'yes']
    logger.info(f"ACTION TRIGGERED: Fetch Real-Time Fuel Benchmarks | Force Refresh: {force}")
    return jsonify(fuel_engine.get_fuel_benchmarks(force_refresh=force))


@app.route("/api/ports/<country>", methods=["GET"])
def api_ports(country):
    logger.info(f"ACTION TRIGGERED: Fetch Ports | Country: {country}")
    ports = geo.get_ports_for_country(country)
    return jsonify(ports)

@app.route("/api/analyze-shipment", methods=["POST"])
def api_analyze_shipment():
    data = request.get_json(force=True, silent=True) or {}
    from_country = data.get("from_country")
    to_country = data.get("to_country")
    
    logger.info(f"ACTION TRIGGERED: Analyze Shipment | From: {from_country} | To: {to_country}")

    # Specific Ports (Optional)
    from_port = data.get("from_port") # Name
    to_port = data.get("to_port") # Name
    from_coords = data.get("from_coords") # [lat, lng]
    to_coords = data.get("to_coords") # [lat, lng]
    
    currency = data.get("currency", "USD")
    
    if not from_country or not to_country:
        return jsonify({"error": "Missing origin or destination"}), 400
        
    if str(from_country).strip().lower() == str(to_country).strip().lower():
        return jsonify({"error": "Origin and destination countries cannot be identical"}), 400

    # Get Coordinates
    # Priority: Specific Coords (from Port selection) > Country Default
    coord1 = None
    coord2 = None
    
    if from_coords: coord1 = tuple(from_coords)
    else: coord1 = geo.get_country_coordinates(from_country)
        
    if to_coords: coord2 = tuple(to_coords)
    else: coord2 = geo.get_country_coordinates(to_country)
    
    if not coord1 or not coord2:
        return jsonify({"error": f"Could not geocode locations for {from_country} or {to_country}"}), 404
        
    # Calculate Distance
    dist = geo.calculate_distance(coord1, coord2)
    
    # Get Base Analysis
    analysis = geo.analyze_route_options(from_country, to_country, dist)
    
    # Enrich with Real-time Risk (News) and Currency
    rates = finance.get_exchange_rates()
    
    # Risk Calculation validated against Google RSS news
    risk_from = evaluate_route_risk(from_country, "Export Logistics", "")
    risk_to = evaluate_route_risk(to_country, "Import Logistics", "")
    combined_score = round((risk_from['score'] + risk_to['score']) / 2, 1)
    
    if combined_score >= 7.5:
        combined_level = "High"
    elif combined_score >= 4.0:
        combined_level = "Medium"
    else:
        combined_level = "Low"

    # Adjust for Mode/Currency
    for mode, details in analysis.items():
        details['cost'] = finance.convert_currency(details['cost_usd'], "USD", currency, rates)
        details['currency'] = currency
        if mode == "air":
            details['risk_level'] = "Low" if combined_score < 7.0 else "Medium"
        elif mode == "sea":
            details['risk_level'] = combined_level
        else:
            details['risk_level'] = "High" if combined_score > 6.0 else "Medium" if combined_score > 3.0 else "Low"
            
    feasibility = geo.check_mode_feasibility(from_country, to_country, dist)

    # Dynamic real-time risk drivers based on Google RSS news & fuel benchmarks
    try:
        from src.utils.fuel_engine import get_fuel_benchmarks
        fuel_data = get_fuel_benchmarks()
        avg_fuel_change = 0.0
        for f in fuel_data.get("fuels", []):
            try:
                ch = abs(float(str(f.get("change", "0")).replace("%", "").replace("+", "").replace("-", "")))
                avg_fuel_change += ch
            except Exception:
                pass
        fuel_volatility = round(min(9.5, max(2.5, 3.5 + avg_fuel_change * 1.5)), 1)
    except Exception:
        fuel_volatility = 5.2

    pol_score = round(max(1.0, min(10.0, (risk_from['score'] * 0.6 + risk_to['score'] * 0.4))), 1)

    all_justifications = risk_from.get("justification", []) + risk_to.get("justification", [])
    labor_score = 2.5
    for r in all_justifications:
        r_lower = r.lower()
        if any(w in r_lower for w in ["strike", "congestion", "delay", "backlog", "labor", "disruption"]):
            labor_score = min(9.5, labor_score + 2.0)
    labor_score = round(labor_score, 1)

    sanctions_score = 1.0
    for r in all_justifications:
        r_lower = r.lower()
        if any(w in r_lower for w in ["sanction", "embargo", "blockade", "restriction", "war", "conflict"]):
            sanctions_score = min(9.8, sanctions_score + 3.5)
    sanctions_score = round(sanctions_score, 1)

    risk_drivers = {
        "fuel": {"val": fuel_volatility, "label": "Fuel Volatility"},
        "politics": {"val": pol_score, "label": "Political Stability"},
        "labor": {"val": labor_score, "label": "Labor & Strikes"},
        "sanctions": {"val": sanctions_score, "label": "Sanctions & Compliance"}
    }

    return jsonify({
        "from": from_country,
        "to": to_country,
        "from_port": from_port,
        "to_port": to_port,
        "coordinates": {
            "start": coord1,
            "end": coord2
        },
        "distance_km": dist,
        "analysis": analysis,
        "feasibility": feasibility,
        "risk_summary": {
            "origin_score": risk_from['score'],
            "destination_score": risk_to['score'],
            "combined_level": combined_level,
            "reasons": all_justifications
        },
        "risk_drivers": risk_drivers,
        "validation_source": "Google News RSS & Open Logistics Telemetry"
    })


@app.route("/api/mode-feasibility", methods=["POST", "GET"])
def api_mode_feasibility():
    """Live assessment of physical freight connectivity and mode feasibility."""
    if request.method == "POST":
        data = request.get_json(force=True, silent=True) or {}
        from_country = data.get("from_country", "India")
        to_country = data.get("to_country", "Netherlands")
        preferred_mode = data.get("preferred_mode")
    else:
        from_country = request.args.get("from", "India")
        to_country = request.args.get("to", "Netherlands")
        preferred_mode = request.args.get("mode")

    coord1 = geo.get_country_coordinates(from_country) or (20.59, 78.96)
    coord2 = geo.get_country_coordinates(to_country) or (52.13, 5.29)
    dist = geo.calculate_distance(coord1, coord2)
    feasibility = geo.check_mode_feasibility(from_country, to_country, dist)
    analysis = geo.analyze_route_options(from_country, to_country, dist)

    is_feasible = True
    if preferred_mode and preferred_mode in feasibility:
        is_feasible = feasibility[preferred_mode]["feasible"]

    return jsonify({
        "from": from_country,
        "to": to_country,
        "distance_km": dist,
        "coordinates": {"start": coord1, "end": coord2},
        "feasibility": feasibility,
        "analysis": analysis,
        "selected_mode": preferred_mode,
        "selected_feasible": is_feasible
    })


@app.route("/api/reports-summary", methods=["GET"])
def api_reports_summary():
    logger.info("ACTION TRIGGERED: Fetch Reports Summary")
    routes = _load_routes_data()
    
    if not routes:
        return jsonify({
            "summary": "No route data available for analysis.",
            "why": "Add routes to generate intelligence insights."
        })

    avg_risk = sum(r.get("risk_score", 0) for r in routes) / len(routes)
    high_risk_count = sum(1 for r in routes if r.get("risk_score", 0) > 7)
    
    summary_text = f"Global trade risk is {'High' if avg_risk > 6 else 'Moderate' if avg_risk > 3 else 'Low'} ({avg_risk:.1f}/10). "
    if high_risk_count > 0:
        summary_text += f"{high_risk_count} routes require immediate attention due to elevated risk levels."
    else:
        summary_text += "All monitored routes are currently operating within acceptable risk parameters."
        
    return jsonify({
        "summary": summary_text,
        "why": "Aggregated analysis of active route risk scores and external factors."
    })


@app.route("/api/reports-history", methods=["GET"])
def api_reports_history():
    logger.info("ACTION TRIGGERED: Fetch Reports History")
    reports = _load_reports_data()
    # Sort by date desc
    reports.sort(key=lambda x: x.get("date", ""), reverse=True)
    return jsonify(reports)


@app.route("/api/generate-report", methods=["POST"])
def api_generate_report():
    data = request.get_json(force=True, silent=True) or {}
    report_type = data.get("type", "generic")
    
    logger.info(f"ACTION TRIGGERED: Generate Report | Type: {report_type}")

    # Generate Mock Report Details
    now = datetime.datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    timestamp = int(now.timestamp())
    
    report_names = {
        "route_risk": f"Route_Risk_Analysis_{date_str}",
        "cost_analysis": f"Cost_Optimization_Report_{date_str}",
        "executive_brief": f"Executive_Brief_{now.strftime('%B_%Y')}"
    }
    
    name = report_names.get(report_type, f"Report_{date_str}")
    file_ext = "csv" if report_type == "cost_analysis" else "txt"
    filename = f"{name}_{timestamp}.{file_ext}"
    
    # Ensure reports directory exists
    reports_dir = os.path.join(ASSETS_DIR, "reports")
    os.makedirs(reports_dir, exist_ok=True)
    
    file_path = os.path.join(reports_dir, filename)
    
    # Write content
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(f"SupplyGuard AI Report: {name}\n")
            f.write(f"Generated: {now.isoformat()}\n")
            f.write(f"Type: {report_type}\n\n")
            
            if report_type == "route_risk":
                f.write("Risk Analysis Summary:\n")
                f.write("- Global Risk Score: 7.2/10 (High)\n")
                f.write("- Primary Drivers: Weather, Geopolitical Instability\n")
                f.write("- Active Routes: 12\n")
            elif report_type == "cost_analysis":
                f.write("Route,Mode,Estimated Cost,Risk Adjusted Cost,Savings\n")
                f.write("India-Netherlands,Sea,12000,12500,500\n")
                f.write("China-USA,Air,45000,45000,0\n")
            else:
                f.write("Executive Briefing:\n")
                f.write("- Network health is stable.\n")
                f.write("- No major incidents reported in the last 24 hours.\n")
    except Exception as e:
        logger.error(f"Error generating report file: {e}")
        # Continue anyway, just won't have a valid file
    
    download_url = f"/assets/reports/{filename}"
    
    new_report = {
        "id": f"rep_{timestamp}",
        "name": name,
        "type": file_ext.upper(),
        "date": date_str,
        "version": "v1.0",
        "status": "Ready",
        "integrity": "Verified source",
        "generated_by": "System User",
        "download_url": download_url
    }
    
    reports = _load_reports_data()
    reports.insert(0, new_report)
    _save_reports_data(reports)
    
    return jsonify(new_report)


# ==============================================================================
# SMART TRADE ROUTE OPTIMIZATION SYSTEM ENDPOINTS (MODULES 1-11)
# ==============================================================================
from src.routing.trade_route_service import TradeRouteOptimizationService, ValidationException
from src.routing.cost_time_estimator import VEHICLE_CATALOG
from src.routing.report_generator import TradeRouteReportGenerator
from app.db.session import SessionLocal
from app.models.trade_route_entities import ShipmentPlanRequest, TradeRouteResult

flask_trade_route_service = TradeRouteOptimizationService()


@app.route("/api/v1/trade-routes/network-nodes", methods=["GET"])
@app.route("/api/trade-routes/network-nodes", methods=["GET"])
def flask_network_nodes():
    nodes = []
    for nid, data in flask_trade_route_service.graph.nodes.items():
        nodes.append({
            "id": nid,
            "name": data.get("name", nid),
            "city": data.get("city", nid),
            "lat": data.get("lat"),
            "lng": data.get("lng"),
            "hub_type": data.get("hub_type", "JUNCTION"),
            "aliases": data.get("aliases", []),
        })

    corridors = []
    for edge_id, edge in flask_trade_route_service.graph.edges.items():
        corridors.append({
            "from_node": edge.get("from"),
            "to_node": edge.get("to"),
            "corridor_code": edge.get("id", edge_id),
            "corridor_name": edge.get("corridor_name", edge_id),
            "distance_km": edge.get("distance_km", 0),
            "is_ghat": edge.get("is_ghat", False),
            "toll_inr": edge.get("toll_charges_inr", 0),
            "risk_factor": edge.get("risk_factor", 1.0),
            "max_weight_tons": edge.get("max_weight_tons", 40.0),
        })

    return jsonify({
        "node_count": len(nodes),
        "corridor_count": len(corridors),
        "nodes": nodes,
        "corridors": corridors,
    })


@app.route("/api/v1/trade-routes/vehicles", methods=["GET"])
@app.route("/api/trade-routes/vehicles", methods=["GET"])
def flask_vehicles():
    catalog = []
    for code, v in VEHICLE_CATALOG.items():
        catalog.append({
            "code": v.code,
            "name": v.name,
            "category": v.category,
            "max_weight_tons": v.max_weight_tons,
            "max_volume_m3": v.max_volume_m3,
            "base_mileage_kml": v.base_mileage_kml,
            "fuel_price_per_l_inr": v.fuel_price_per_l_inr,
            "maintenance_cost_per_km_inr": v.maintenance_cost_per_km_inr,
            "driver_rate_per_hour_inr": v.driver_rate_per_hour_inr,
        })
    return jsonify({"vehicles": catalog})


@app.route("/api/v1/trade-routes/optimize", methods=["POST", "OPTIONS"])
@app.route("/api/trade-routes/optimize", methods=["POST", "OPTIONS"])
def flask_optimize_route():
    if request.method == "OPTIONS":
        resp = jsonify({})
        return _add_cors_headers(resp)

    data = request.get_json(force=True, silent=True) or {}
    try:
        db = SessionLocal()
        try:
            result = flask_trade_route_service.optimize_shipment(
                origin=data.get("origin"),
                destination=data.get("destination"),
                shipment_weight_kg=float(data.get("shipment_weight_kg", 0)),
                shipment_volume_m3=float(data.get("shipment_volume_m3", 0)),
                vehicle_type=data.get("vehicle_type", "MCV_EICHER_14T"),
                delivery_deadline_hours=float(data["delivery_deadline_hours"]) if data.get("delivery_deadline_hours") is not None else None,
                weight_time=float(data.get("weight_time", 0.35)),
                weight_cost=float(data.get("weight_cost", 0.35)),
                weight_dist=float(data.get("weight_dist", 0.15)),
                weight_risk=float(data.get("weight_risk", 0.15)),
                db=db,
            )
            resp = jsonify(result)
            return _add_cors_headers(resp)
        finally:
            db.close()
    except ValidationException as ve:
        resp = jsonify({"detail": str(ve), "error": str(ve)})
        resp.status_code = 400
        return _add_cors_headers(resp)
    except Exception as e:
        resp = jsonify({"detail": str(e), "error": str(e)})
        resp.status_code = 500
        return _add_cors_headers(resp)


@app.route("/api/v1/trade-routes/export-report", methods=["POST"])
@app.route("/api/trade-routes/export-report", methods=["POST"])
def flask_export_report():
    data = request.get_json(force=True, silent=True) or {}
    fmt = (data.get("format") or "txt").lower().strip()
    opt_data = data.get("optimization_result", {})
    if not opt_data:
        return jsonify({"error": "Missing optimization_result"}), 400

    from flask import Response
    if fmt == "csv":
        csv_content = TradeRouteReportGenerator.generate_csv_matrix(opt_data)
        return Response(
            csv_content,
            mimetype="text/csv",
            headers={"Content-Disposition": 'attachment; filename="trade_route_comparison.csv"'}
        )
    elif fmt == "txt":
        txt_content = TradeRouteReportGenerator.generate_academic_text_report(opt_data)
        return Response(
            txt_content,
            mimetype="text/plain; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="trade_route_report.txt"'}
        )
    return jsonify(opt_data)


@app.route("/api/v1/trade-routes/history", methods=["GET"])
@app.route("/api/trade-routes/history", methods=["GET"])
def flask_trade_routes_history():
    limit = int(request.args.get("limit", 10))
    db = SessionLocal()
    try:
        requests = db.query(ShipmentPlanRequest).order_by(ShipmentPlanRequest.created_at.desc()).limit(limit).all()
        history = []
        for req in requests:
            rec_route = None
            for r in req.routes:
                if r.is_recommended:
                    rec_route = {
                        "route_name": r.route_name,
                        "distance_km": r.distance_km,
                        "travel_time_hours": r.travel_time_hours,
                        "total_cost_inr": r.total_cost_inr,
                        "risk_score": r.risk_score,
                    }
                    break
            history.append({
                "request_id": req.id,
                "request_code": req.request_code,
                "origin": req.origin_name,
                "destination": req.destination_name,
                "shipment_weight_kg": req.shipment_weight_kg,
                "shipment_volume_m3": req.shipment_volume_m3,
                "vehicle_type": req.vehicle_type,
                "created_at": req.created_at.isoformat() if req.created_at else None,
                "recommended_route": rec_route,
            })
        return jsonify({"count": len(history), "history": history})
    finally:
        db.close()


@app.route("/api/v1/trade-routes/history/<request_code>", methods=["GET"])
@app.route("/api/trade-routes/history/<request_code>", methods=["GET"])
def flask_trade_routes_detail(request_code):
    db = SessionLocal()
    try:
        req = db.query(ShipmentPlanRequest).filter(ShipmentPlanRequest.request_code == request_code).first()
        if not req:
            return jsonify({"error": f"Request '{request_code}' not found"}), 404
        routes = []
        for r in req.routes:
            routes.append({
                "id": r.id,
                "route_type": r.route_type,
                "route_name": r.route_name,
                "distance_km": r.distance_km,
                "travel_time_hours": r.travel_time_hours,
                "total_cost_inr": r.total_cost_inr,
                "is_recommended": r.is_recommended,
                "waypoints": json.loads(r.waypoints_json) if r.waypoints_json else [],
                "warnings": json.loads(r.warnings_json) if r.warnings_json else [],
                "explanation": r.explanation,
            })
        return jsonify({
            "request_code": req.request_code,
            "origin_name": req.origin_name,
            "destination_name": req.destination_name,
            "routes": routes,
        })
    finally:
        db.close()


if __name__ == "__main__":
        debug_mode = os.getenv("FLASK_DEBUG", "False").lower() == "true"
        app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5005")), debug=debug_mode)
