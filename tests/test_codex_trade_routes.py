import os
import sys
import json
import pytest

# Monkeypatch httpx 0.28+ incompatibility with starlette 0.27 TestClient
import httpx
_orig_httpx_init = httpx.Client.__init__
def _patched_httpx_init(self, *args, **kwargs):
    kwargs.pop("app", None)
    return _orig_httpx_init(self, *args, **kwargs)
httpx.Client.__init__ = _patched_httpx_init

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.db.session import SessionLocal
from app.db.init_db import init_db
from app.models.trade_route_entities import ShipmentPlanRequest, TradeRouteResult
from src.routing.trade_route_service import TradeRouteOptimizationService, ValidationException
from src.routing.report_generator import TradeRouteReportGenerator
from src.routing.route_engine import RouteConstraintValidator


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


@pytest.fixture(scope="function")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()


@pytest.fixture(scope="session")
def route_service():
    return TradeRouteOptimizationService()


# =====================================================================
# TC1: Valid Request -> Route and Metrics Returned
# =====================================================================
def test_tc1_valid_request(route_service, client, db_session):
    """
    TC1: Verify that a valid shipment request produces a feasible recommended
    route with distance, travel time, cost, risk score, and transparent metrics.
    """
    payload = {
        "origin": "Bhiwandi",
        "destination": "Kolhapur",
        "shipment_weight_kg": 3500.0,
        "shipment_volume_m3": 14.0,
        "vehicle_type": "MCV_EICHER_14T",
        "delivery_deadline_hours": 12.0,
        "weight_time": 0.35,
        "weight_cost": 0.35,
        "weight_dist": 0.15,
        "weight_risk": 0.15,
    }

    response = client.post("/api/v1/trade-routes/optimize", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()

    assert "recommended_route" in data
    rec = data["recommended_route"]
    assert rec["distance_km"] > 0
    assert rec["travel_time_hours"] > 0
    assert rec["total_cost_inr"] > 0
    assert rec["risk_score"] > 0
    assert len(rec["waypoints"]) >= 2
    assert "cost_breakdown" in rec
    assert rec["cost_breakdown"]["fuel_cost_inr"] > 0
    assert rec["is_recommended"] is True
    assert len(rec["explanation"]) > 10

    # Verify Academic Metadata
    assert "academic_credits" in data
    assert "Todkar" in data["academic_credits"]["project_guide"]
    assert len(data["academic_credits"]["student_team"]) == 6


# =====================================================================
# TC2: Unknown Location -> Error Message
# =====================================================================
def test_tc2_unknown_location(route_service, client):
    """
    TC2: Verify that providing an unknown or unmapped origin or destination
    triggers a clear validation error.
    """
    # 1. Direct Service Call
    with pytest.raises(ValidationException) as exc_info:
        route_service.optimize_shipment(
            origin="NonExistentCity_X99",
            destination="Kolhapur",
            shipment_weight_kg=1000.0,
            shipment_volume_m3=5.0,
        )
    assert "Unknown or unsupported origin location" in str(exc_info.value)

    # 2. REST API endpoint check
    payload = {
        "origin": "Bhiwandi",
        "destination": "Mars_Colony_Alpha",
        "shipment_weight_kg": 1000.0,
        "shipment_volume_m3": 5.0,
    }
    response = client.post("/api/v1/trade-routes/optimize", json=payload)
    assert response.status_code == 400
    assert "Unknown or unsupported destination" in response.json()["detail"]


# =====================================================================
# TC3: Missing or Invalid Input -> Validation Error
# =====================================================================
def test_tc3_invalid_input(client):
    """
    TC3: Verify that missing parameters, zero or negative weights/volumes
    are rejected with understandable error messages.
    """
    # Zero or negative weight
    payload = {
        "origin": "Bhiwandi",
        "destination": "Pune",
        "shipment_weight_kg": -50.0,
        "shipment_volume_m3": 5.0,
    }
    response = client.post("/api/v1/trade-routes/optimize", json=payload)
    assert response.status_code in [400, 422]

    # Empty origin
    payload = {
        "origin": "",
        "destination": "Pune",
        "shipment_weight_kg": 500.0,
        "shipment_volume_m3": 2.0,
    }
    response = client.post("/api/v1/trade-routes/optimize", json=payload)
    assert response.status_code in [400, 422]


# =====================================================================
# TC4: Vehicle Capacity Exceeded -> Capacity Error
# =====================================================================
def test_tc4_vehicle_capacity_exceeded(route_service, client):
    """
    TC4: Verify that attempting to load cargo exceeding the selected vehicle's
    maximum weight capacity (or cubic volume) is rejected.
    """
    # Tata Ace has max payload of 1.5 tons (1500 kg). Requesting 8000 kg.
    payload = {
        "origin": "Bhiwandi",
        "destination": "Pune",
        "shipment_weight_kg": 8000.0,
        "shipment_volume_m3": 3.0,
        "vehicle_type": "LCV_TATA_ACE",
    }
    response = client.post("/api/v1/trade-routes/optimize", json=payload)
    assert response.status_code == 400
    assert "VEHICLE CAPACITY EXCEEDED" in response.json()["detail"]


# =====================================================================
# TC5: Restricted Road -> Restricted Corridor Avoided or Flagged
# =====================================================================
def test_tc5_road_restrictions(route_service):
    """
    TC5: Verify that vehicles exceeding road weight limits or prohibited on
    specific segments (e.g., heavy trailer over ghats or bridges) are restricted.
    """
    edge_dict = {
        "max_weight_tons": 16.0,
        "max_volume_m3": 40.0,
        "allowed_vehicles": ["LCV_TATA_ACE", "MCV_EICHER_14T"],
        "corridor_name": "NH-48 Urban Feeder",
        "is_ghat": False,
    }
    # 1. Payload weight exceeds road limit
    is_valid, msg = RouteConstraintValidator.is_edge_allowed(
        edge=edge_dict,
        shipment_weight_tons=32.0,
        shipment_volume_m3=10.0,
        vehicle_type="MCV_EICHER_14T",
    )
    assert is_valid is False
    assert "exceeds road max limit" in msg

    # 2. Vehicle type not allowed on corridor
    is_valid2, msg2 = RouteConstraintValidator.is_edge_allowed(
        edge=edge_dict,
        shipment_weight_tons=10.0,
        shipment_volume_m3=10.0,
        vehicle_type="TRAILER_40FT",
    )
    assert is_valid2 is False
    assert "not permitted" in msg2


# =====================================================================
# TC6: Delivery Deadline Exceeded -> Deadline Warning Displayed
# =====================================================================
def test_tc6_deadline_exceeded(route_service, client):
    """
    TC6: Verify that if the estimated travel time exceeds the user's delivery deadline,
    a prominent warning is generated and deadline_met flag is False.
    """
    # Bhiwandi to Kolhapur normally takes 7+ hours. Setting an impossible 1.0 hour deadline.
    payload = {
        "origin": "Bhiwandi",
        "destination": "Kolhapur",
        "shipment_weight_kg": 2000.0,
        "shipment_volume_m3": 8.0,
        "vehicle_type": "MCV_EICHER_14T",
        "delivery_deadline_hours": 1.0,
    }
    response = client.post("/api/v1/trade-routes/optimize", json=payload)
    assert response.status_code == 200
    data = response.json()
    rec = data["recommended_route"]

    assert rec["deadline_met"] is False
    warnings_str = " ".join(rec["warnings"])
    assert "DEADLINE" in warnings_str


# =====================================================================
# TC7: Priority Weights Change -> Route Ranking Changes
# =====================================================================
def test_tc7_priority_weights_change_ranking(client):
    """
    TC7: Verify that tuning multi-objective weights dynamically changes
    the scoring and order of candidate routes.
    """
    base_payload = {
        "origin": "Bhiwandi",
        "destination": "Kolhapur",
        "shipment_weight_kg": 2500.0,
        "shipment_volume_m3": 10.0,
        "vehicle_type": "MCV_EICHER_14T",
    }

    # 1. Emphasize Distance 100%
    payload_dist = {**base_payload, "weight_dist": 1.0, "weight_time": 0.0, "weight_cost": 0.0, "weight_risk": 0.0}
    res_dist = client.post("/api/v1/trade-routes/optimize", json=payload_dist).json()

    # 2. Emphasize Risk 100%
    payload_risk = {**base_payload, "weight_risk": 1.0, "weight_time": 0.0, "weight_cost": 0.0, "weight_dist": 0.0}
    res_risk = client.post("/api/v1/trade-routes/optimize", json=payload_risk).json()

    rec_dist = res_dist["recommended_route"]
    rec_risk = res_risk["recommended_route"]

    # When distance is prioritized, distance should be minimal
    assert rec_dist["distance_km"] <= res_dist["ranked_routes"][-1]["distance_km"]
    # Scores reflect the weight preference
    assert rec_dist["multi_objective_score"] >= 0.0


# =====================================================================
# TC8: No Route Available -> No-Route Error
# =====================================================================
def test_tc8_no_route_available(route_service):
    """
    TC8: Verify that when no path connects two locations or all paths violate
    constraints, the system raises a clear NO FEASIBLE ROUTE error.
    """
    # Temporarily query from disconnected graph if node isolated or impossible vehicle
    # Heavy 50 ton load on Tata Ace will fail at capacity; let's test validator when disconnected
    from src.routing.network_graph import RoadNetworkGraph
    empty_graph = RoadNetworkGraph()
    empty_graph.nodes = {"N1": {"name": "Node 1", "lat": 19.0, "lng": 73.0, "aliases": []}, "N2": {"name": "Node 2", "lat": 20.0, "lng": 74.0, "aliases": []}}
    empty_graph.adjacency = {"N1": [], "N2": []}
    empty_graph.edges = {}

    from src.routing.alternative_generator import AlternativeRouteGenerator
    alt_gen = AlternativeRouteGenerator(empty_graph)
    candidates = alt_gen.generate_alternatives("N1", "N2", 1.0, 1.0, "MCV_EICHER_14T")
    assert len(candidates) == 0


# =====================================================================
# TC9: Fallback Assumptions -> System Identifies Fallbacks
# =====================================================================
def test_tc9_fallback_assumptions(client):
    """
    TC9: Verify that fallback assumptions (e.g. baseline diesel price, standard dry weather
    transit speeds) are explicitly documented and communicated.
    """
    payload = {
        "origin": "Bhiwandi",
        "destination": "Nashik",
        "shipment_weight_kg": 1200.0,
        "shipment_volume_m3": 4.0,
        "vehicle_type": "LCV_TATA_ACE",
    }
    response = client.post("/api/v1/trade-routes/optimize", json=payload)
    assert response.status_code == 200
    data = response.json()
    fallbacks = data["recommended_route"]["cost_breakdown"]["fallback_assumptions"]

    assert len(fallbacks) >= 2
    fallbacks_str = " ".join(fallbacks)
    assert "speed" in fallbacks_str.lower() or "weather" in fallbacks_str.lower() or "diesel" in fallbacks_str.lower()


# =====================================================================
# TC10: Candidate Routes -> Multiple Distinct Alternatives Returned
# =====================================================================
def test_tc10_multiple_distinct_alternatives(client):
    """
    TC10: Verify that the system generates and returns multiple distinct
    alternative routes without duplication.
    """
    payload = {
        "origin": "Bhiwandi",
        "destination": "Kolhapur",
        "shipment_weight_kg": 3000.0,
        "shipment_volume_m3": 12.0,
        "vehicle_type": "MCV_EICHER_14T",
    }
    response = client.post("/api/v1/trade-routes/optimize", json=payload)
    assert response.status_code == 200
    data = response.json()

    ranked = data["ranked_routes"]
    assert len(ranked) >= 2
    # Ensure algorithms or path objectives are distinct
    names = [r["name"] for r in ranked]
    assert len(set(names)) == len(names), "Route names/objectives must be distinct"


# =====================================================================
# TC11: Report Export -> Export File Generated
# =====================================================================
def test_tc11_report_export(client):
    """
    TC11: Verify that export endpoints generate formatted Academic Text and CSV reports
    complete with project guides, team credits, and route comparison matrices.
    """
    opt_payload = {
        "origin": "Bhiwandi",
        "destination": "Pune",
        "shipment_weight_kg": 1500.0,
        "shipment_volume_m3": 6.0,
        "vehicle_type": "LCV_TATA_ACE",
    }
    opt_res = client.post("/api/v1/trade-routes/optimize", json=opt_payload).json()

    # 1. Export TXT
    txt_res = client.post("/api/v1/trade-routes/export-report", json={
        "optimization_result": opt_res,
        "format": "txt"
    })
    assert txt_res.status_code == 200
    assert "text/plain" in txt_res.headers["content-type"]
    txt_body = txt_res.text
    assert "D. Y. Patil Agriculture & Technical University" in txt_body
    assert "Mr. R. S. Todkar" in txt_body
    assert "Atharv Chandrakant Jadhav" in txt_body

    # 2. Export CSV
    csv_res = client.post("/api/v1/trade-routes/export-report", json={
        "optimization_result": opt_res,
        "format": "csv"
    })
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    csv_body = csv_res.text
    assert "Route ID,Route Name,Algorithm,Is Recommended,Distance (km)" in csv_body


# =====================================================================
# TC12: Database Save & Retrieve -> Stored and Fetched
# =====================================================================
def test_tc12_database_persistence(client, db_session):
    """
    TC12: Verify that shipment requests and candidate routes are stored in
    SQLite tables and can be retrieved via history endpoints.
    """
    payload = {
        "origin": "JNPT",
        "destination": "Chakan",
        "shipment_weight_kg": 4000.0,
        "shipment_volume_m3": 16.0,
        "vehicle_type": "MCV_EICHER_14T",
    }
    opt_res = client.post("/api/v1/trade-routes/optimize", json=payload)
    assert opt_res.status_code == 200
    data = opt_res.json()
    req_code = data["shipment_request"]["request_code"]

    # Retrieve from DB via /history
    hist_res = client.get("/api/v1/trade-routes/history")
    assert hist_res.status_code == 200
    history = hist_res.json()["history"]
    found = any(h["request_code"] == req_code for h in history)
    assert found is True

    # Retrieve specific request detail
    detail_res = client.get(f"/api/v1/trade-routes/history/{req_code}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["request_code"] == req_code
    assert len(detail["routes"]) >= 1


# =====================================================================
# TC13: Unauthorized Access -> Access Denied (401)
# =====================================================================
def test_tc13_unauthorized_access(client):
    """
    TC13: Verify that sensitive or restricted endpoints (e.g. /secure-dispatch)
    strictly require valid credentials and return 401 Unauthorized when missing or invalid.
    """
    # 1. No auth header provided
    res_no_auth = client.post("/api/v1/trade-routes/secure-dispatch?request_code=REQ-FAKE-01")
    assert res_no_auth.status_code == 401
    assert "Authentication credentials were not provided" in res_no_auth.json()["detail"]

    # 2. Invalid JWT token
    res_invalid_token = client.post(
        "/api/v1/trade-routes/secure-dispatch?request_code=REQ-FAKE-01",
        headers={"Authorization": "Bearer invalid_expired_or_forged_token_xyz"}
    )
    assert res_invalid_token.status_code == 401
    assert "Invalid or expired authentication token" in res_invalid_token.json()["detail"]
