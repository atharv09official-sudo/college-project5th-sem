import json
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import User
from app.api.v1.deps import get_current_user, require_authenticated_user
from app.models.trade_route_entities import ShipmentPlanRequest, TradeRouteResult
from app.schemas.trade_routes import (
    TradeRouteOptimizePayload,
    TradeRouteOptimizeResponse,
    ReportExportPayload,
)
from src.routing.trade_route_service import TradeRouteOptimizationService, ValidationException
from src.routing.cost_time_estimator import VEHICLE_CATALOG
from src.routing.report_generator import TradeRouteReportGenerator

router = APIRouter(prefix="/trade-routes", tags=["AI-Powered Smart Trade Route Optimization"])

# Singleton service instance
route_service = TradeRouteOptimizationService()


@router.post("/optimize", response_model=TradeRouteOptimizeResponse)
def optimize_trade_route(
    payload: TradeRouteOptimizePayload,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Module 1 to 8:
    Validates shipment inputs and runs multi-objective routing (Dijkstra + A*)
    evaluating shortest distance, fastest travel time, lowest cost, and lowest risk.
    Persists plan request & route results into Module 10 database.
    """
    try:
        result = route_service.optimize_shipment(
            origin=payload.origin,
            destination=payload.destination,
            shipment_weight_kg=payload.shipment_weight_kg,
            shipment_volume_m3=payload.shipment_volume_m3,
            vehicle_type=payload.vehicle_type,
            delivery_deadline_hours=payload.delivery_deadline_hours,
            weight_time=payload.weight_time,
            weight_cost=payload.weight_cost,
            weight_dist=payload.weight_dist,
            weight_risk=payload.weight_risk,
            db=db,
        )
        return result
    except ValidationException as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Optimization engine error: {str(e)}",
        )


@router.get("/network-nodes")
def get_network_nodes():
    """
    Module 2: Road Network Graph Representation.
    Returns nodes (coordinates, hubs) and corridors for vector map rendering.
    """
    nodes = []
    for nid, data in route_service.graph.nodes.items():
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
    for edge_id, edge in route_service.graph.edges.items():
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

    return {
        "node_count": len(nodes),
        "corridor_count": len(corridors),
        "nodes": nodes,
        "corridors": corridors,
    }


@router.get("/vehicles")
def get_vehicle_catalog():
    """Returns available vehicle classes with capacity, volume, mileage, and restrictions."""
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
    return {"vehicles": catalog}


@router.get("/history")
def get_shipment_history(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Module 10: Database Management.
    Retrieves previous shipment requests and saved recommendations.
    """
    requests = (
        db.query(ShipmentPlanRequest)
        .order_by(ShipmentPlanRequest.created_at.desc())
        .limit(limit)
        .all()
    )

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
                    "algorithm_used": r.algorithm_used,
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
            "delivery_deadline_hours": req.delivery_deadline_hours,
            "created_at": req.created_at.isoformat() if req.created_at else None,
            "recommended_route": rec_route,
        })

    return {"count": len(history), "history": history}


@router.get("/history/{request_code}")
def get_shipment_detail(
    request_code: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Retrieves full candidate routes, metrics, and waypoints for a specific historical request."""
    req = db.query(ShipmentPlanRequest).filter(ShipmentPlanRequest.request_code == request_code).first()
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shipment request '{request_code}' not found."
        )

    routes = []
    for r in req.routes:
        routes.append({
            "id": r.id,
            "route_type": r.route_type,
            "route_name": r.route_name,
            "algorithm_used": r.algorithm_used,
            "distance_km": r.distance_km,
            "travel_time_hours": r.travel_time_hours,
            "total_cost_inr": r.total_cost_inr,
            "toll_charges_inr": r.toll_charges_inr,
            "fuel_cost_inr": r.fuel_cost_inr,
            "risk_score": r.risk_score,
            "multi_objective_score": r.multi_objective_score,
            "is_recommended": r.is_recommended,
            "waypoints": json.loads(r.waypoints_json) if r.waypoints_json else [],
            "warnings": json.loads(r.warnings_json) if r.warnings_json else [],
            "explanation": r.explanation,
        })

    return {
        "request_code": req.request_code,
        "origin_name": req.origin_name,
        "destination_name": req.destination_name,
        "weight_kg": req.shipment_weight_kg,
        "volume_m3": req.shipment_volume_m3,
        "vehicle_type": req.vehicle_type,
        "deadline_hours": req.delivery_deadline_hours,
        "created_at": req.created_at.isoformat() if req.created_at else None,
        "routes": routes,
    }


@router.post("/export-report")
def export_trade_route_report(payload: ReportExportPayload):
    """
    Module 11: Report Generation.
    Generates a route summary report in plain text, CSV, or structured JSON.
    """
    fmt = (payload.format or "txt").lower().strip()
    opt_data = payload.optimization_result
    if not opt_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing optimization_result payload to generate report."
        )

    if fmt == "csv":
        csv_content = TradeRouteReportGenerator.generate_csv_matrix(opt_data)
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="trade_route_comparison.csv"'}
        )
    elif fmt == "txt":
        txt_content = TradeRouteReportGenerator.generate_academic_text_report(opt_data)
        return Response(
            content=txt_content,
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="trade_route_report.txt"'}
        )
    else:
        return opt_data


@router.post("/secure-dispatch")
def secure_dispatch_shipment(
    request_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_authenticated_user),
):
    """
    Module 1: Access Control & Authorization (TC13).
    Strictly requires a valid authenticated JWT token.
    Rejects unauthorized access with 401 Unauthorized.
    """
    req = db.query(ShipmentPlanRequest).filter(ShipmentPlanRequest.request_code == request_code).first()
    if not req:
        raise HTTPException(status_code=404, detail=f"Request code '{request_code}' not found.")

    return {
        "status": "DISPATCH_CONFIRMED",
        "request_code": req.request_code,
        "authorized_by": current_user.email,
        "user_role": current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        "timestamp": json.loads(json.dumps(req.created_at.isoformat())),
    }
