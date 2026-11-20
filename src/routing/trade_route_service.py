import uuid
import json
import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from .network_graph import RoadNetworkGraph
from .alternative_generator import AlternativeRouteGenerator
from .multi_objective_scorer import MultiObjectiveScorer, RouteMetrics
from .cost_time_estimator import CostTimeEstimator, VEHICLE_CATALOG
from .predictive_analytics import PredictiveLogisticsAnalytics
from .report_generator import TradeRouteReportGenerator

from app.models.trade_route_entities import ShipmentPlanRequest, TradeRouteResult


class ValidationException(Exception):
    pass


class TradeRouteOptimizationService:
    """
    Main Service Coordinator for the AI-Powered Smart Trade Route Optimization System.
    Orchestrates Modules 1 through 11.
    """

    def __init__(self, data_path: Optional[str] = None):
        self.graph = RoadNetworkGraph(data_path)
        self.alternative_gen = AlternativeRouteGenerator(self.graph)
        self.estimator = CostTimeEstimator()
        self.analytics = PredictiveLogisticsAnalytics()

    def optimize_shipment(
        self,
        origin: str,
        destination: str,
        shipment_weight_kg: float,
        shipment_volume_m3: float,
        vehicle_type: str = "LCV_TATA_ACE",
        delivery_deadline_hours: Optional[float] = None,
        weight_time: float = 0.35,
        weight_cost: float = 0.35,
        weight_dist: float = 0.15,
        weight_risk: float = 0.15,
        db: Optional[Session] = None
    ) -> Dict[str, Any]:
        """
        Executes the end-to-end route optimization pipeline with full constraint validation.
        """
        # ==========================================
        # 1. Module 1: Input Validation
        # ==========================================
        if not origin or not str(origin).strip():
            raise ValidationException("Origin location is required.")
        if not destination or not str(destination).strip():
            raise ValidationException("Destination location is required.")
        if shipment_weight_kg is None or shipment_weight_kg <= 0:
            raise ValidationException(f"Invalid shipment weight: {shipment_weight_kg} kg. Must be greater than 0.")
        if shipment_volume_m3 is None or shipment_volume_m3 <= 0:
            raise ValidationException(f"Invalid shipment volume: {shipment_volume_m3} m3. Must be greater than 0.")

        # Resolve Origin & Destination against graph
        origin_node_id = self.graph.resolve_location(origin)
        if not origin_node_id:
            raise ValidationException(f"Unknown or unsupported origin location: '{origin}'.")

        dest_node_id = self.graph.resolve_location(destination)
        if not dest_node_id:
            raise ValidationException(f"Unknown or unsupported destination location: '{destination}'.")

        if origin_node_id == dest_node_id:
            raise ValidationException(f"Origin and destination cannot be identical ({origin_node_id}).")

        # Vehicle validation
        vehicle = self.estimator.get_vehicle(vehicle_type)
        shipment_weight_tons = round(shipment_weight_kg / 1000.0, 3)

        # Capacity Checking (TC4)
        if shipment_weight_tons > vehicle.max_weight_tons:
            raise ValidationException(
                f"VEHICLE CAPACITY EXCEEDED: Shipment payload {shipment_weight_tons:.2f}T exceeds vehicle '{vehicle.name}' "
                f"maximum payload limit of {vehicle.max_weight_tons:.1f}T."
            )
        if shipment_volume_m3 > vehicle.max_volume_m3:
            raise ValidationException(
                f"VEHICLE VOLUME EXCEEDED: Cargo volume {shipment_volume_m3:.2f} m3 exceeds vehicle '{vehicle.name}' "
                f"maximum cargo compartment of {vehicle.max_volume_m3:.1f} m3."
            )

        # ==========================================
        # 2. Module 4: Alternative Route Generation (Dijkstra + A*)
        # ==========================================
        candidates = self.alternative_gen.generate_alternatives(
            start_node_id=origin_node_id,
            goal_node_id=dest_node_id,
            shipment_weight_tons=shipment_weight_tons,
            shipment_volume_m3=shipment_volume_m3,
            vehicle_type=vehicle.code
        )

        if not candidates:
            # TC8: No available route under vehicle restrictions
            raise ValidationException(
                f"NO FEASIBLE ROUTE AVAILABLE: Unable to find a route between {origin_node_id} and {dest_node_id} "
                f"complying with vehicle restrictions for {vehicle.name}."
            )

        # ==========================================
        # 3. Module 7: Multi-Objective Optimization
        # ==========================================
        scorer = MultiObjectiveScorer(
            w_time=weight_time,
            w_cost=weight_cost,
            w_dist=weight_dist,
            w_risk=weight_risk
        )
        ranked_routes = scorer.rank_routes(candidates, deadline_hours=delivery_deadline_hours)

        # ==========================================
        # 4. Module 8: Predictive ML Analytics for Top Route
        # ==========================================
        rec_route = ranked_routes[0]
        ml_prediction = self.analytics.predict_trip_metrics(
            distance_km=rec_route["distance_km"],
            payload_tons=shipment_weight_tons,
            is_ghat=rec_route["is_ghat"]
        )

        # Mission Request Metadata
        req_code = f"REQ-DYPATU-{int(datetime.datetime.utcnow().timestamp())}-{uuid.uuid4().hex[:4].upper()}"
        shipment_meta = {
            "request_code": req_code,
            "origin_id": origin_node_id,
            "origin_name": self.graph.nodes[origin_node_id]["name"],
            "destination_id": dest_node_id,
            "destination_name": self.graph.nodes[dest_node_id]["name"],
            "shipment_weight_kg": shipment_weight_kg,
            "shipment_volume_m3": shipment_volume_m3,
            "vehicle_type": vehicle.code,
            "vehicle_name": vehicle.name,
            "vehicle_capacity_tons": vehicle.max_weight_tons,
            "vehicle_capacity_m3": vehicle.max_volume_m3,
            "delivery_deadline_hours": delivery_deadline_hours,
            "weight_time": scorer.w_time,
            "weight_cost": scorer.w_cost,
            "weight_dist": scorer.w_dist,
            "weight_risk": scorer.w_risk,
            "status": "OPTIMIZED"
        }

        response = {
            "shipment_request": shipment_meta,
            "recommended_route": rec_route,
            "ranked_routes": ranked_routes,
            "predictive_analytics": ml_prediction,
            "total_candidates_evaluated": len(ranked_routes),
            "academic_credits": TradeRouteReportGenerator.ACADEMIC_METADATA
        }

        # ==========================================
        # 5. Module 10: Database Management
        # ==========================================
        if db is not None:
            self._save_to_database(db, shipment_meta, ranked_routes)

        return response

    def _save_to_database(
        self,
        db: Session,
        shipment_meta: Dict[str, Any],
        ranked_routes: List[Dict[str, Any]]
    ) -> None:
        """Stores shipment request and route results in SQLite/SQLAlchemy."""
        try:
            req_record = ShipmentPlanRequest(
                request_code=shipment_meta["request_code"],
                origin_node_id=shipment_meta["origin_id"],
                destination_node_id=shipment_meta["destination_id"],
                origin_name=shipment_meta["origin_name"],
                destination_name=shipment_meta["destination_name"],
                shipment_weight_kg=shipment_meta["shipment_weight_kg"],
                shipment_volume_m3=shipment_meta["shipment_volume_m3"],
                vehicle_type=shipment_meta["vehicle_type"],
                delivery_deadline_hours=shipment_meta["delivery_deadline_hours"],
                weight_time=shipment_meta["weight_time"],
                weight_cost=shipment_meta["weight_cost"],
                weight_dist=shipment_meta["weight_dist"],
                weight_risk=shipment_meta["weight_risk"],
                status="OPTIMIZED"
            )
            db.add(req_record)
            db.flush()

            for idx, r in enumerate(ranked_routes):
                route_rec = TradeRouteResult(
                    request_id=req_record.id,
                    route_type="RECOMMENDED" if r.get("is_recommended") else f"ALTERNATIVE_{idx}",
                    route_name=r["name"],
                    algorithm_used=r.get("algorithm", "A*"),
                    distance_km=r["distance_km"],
                    travel_time_hours=r["travel_time_hours"],
                    total_cost_inr=r["total_cost_inr"],
                    toll_charges_inr=r.get("cost_breakdown", {}).get("toll_charges_inr", 0.0),
                    fuel_cost_inr=r.get("cost_breakdown", {}).get("fuel_cost_inr", 0.0),
                    risk_score=r["risk_score"],
                    multi_objective_score=r["multi_objective_score"],
                    is_recommended=bool(r.get("is_recommended", False)),
                    waypoints_json=json.dumps(r.get("waypoints", [])),
                    warnings_json=json.dumps(r.get("warnings", [])),
                    explanation=r.get("explanation", "")
                )
                db.add(route_rec)

            db.commit()
        except Exception as e:
            db.rollback()
            print(f"Warning: Failed to persist shipment record to database: {e}")
