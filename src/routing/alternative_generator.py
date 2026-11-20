from typing import List, Dict, Any, Optional
from .network_graph import RoadNetworkGraph
from .route_engine import DijkstraRouter, AStarRouter
from .cost_time_estimator import CostTimeEstimator
from .multi_objective_scorer import RouteMetrics


class AlternativeRouteGenerator:
    """
    Module 4: Alternative Route Generation
    Generates multiple distinct route options:
    1. Shortest Distance
    2. Fastest Travel Time
    3. Lowest Transportation Cost
    4. Lowest Estimated Risk / Safest
    Deduplicates identical paths by exploring bypass and secondary corridors.
    """

    def __init__(self, graph: RoadNetworkGraph):
        self.graph = graph
        self.dijkstra = DijkstraRouter(graph)
        self.astar = AStarRouter(graph)
        self.estimator = CostTimeEstimator()

    def generate_alternatives(
        self,
        start_node_id: str,
        goal_node_id: str,
        shipment_weight_tons: float = 2.0,
        shipment_volume_m3: float = 8.0,
        vehicle_type: str = "LCV_TATA_ACE"
    ) -> List[RouteMetrics]:
        candidates: List[RouteMetrics] = []
        seen_paths = set()

        objectives = [
            ("fastest", "Fastest Transit Corridor (A* Optimized)", "time", self.astar),
            ("shortest", "Shortest Direct Distance Route (Dijkstra)", "distance", self.dijkstra),
            ("lowest_cost", "Lowest Freight & Toll Cost Route (Dijkstra)", "cost", self.dijkstra),
            ("safest", "Lowest Risk Bypass Corridor (Safe Transit)", "risk", self.dijkstra)
        ]

        for code, label, obj, router in objectives:
            res = router.search(
                start_node_id=start_node_id,
                goal_node_id=goal_node_id,
                objective=obj,
                shipment_weight_tons=shipment_weight_tons,
                shipment_volume_m3=shipment_volume_m3,
                vehicle_type=vehicle_type,
                allow_ghats=True
            )

            if not res:
                continue

            path_key = "-".join(res["path_nodes"])

            # Check if this route is identical to one already found
            is_ghat = any(e.get("is_ghat", False) for e in res["edges"])
            cost_details = self.estimator.estimate(
                distance_km=res["total_distance_km"],
                raw_travel_time_hours=res["estimated_time_hours"],
                toll_charges_inr=res["toll_charges_inr"],
                vehicle_type_code=vehicle_type,
                shipment_weight_tons=shipment_weight_tons,
                is_ghat_route=is_ghat
            )

            warnings = []
            if is_ghat:
                warnings.append("Ghat Section Caution: Steep gradient and monsoon curves on route.")

            # If identical path, try non-ghat or secondary route if available
            if path_key in seen_paths and is_ghat:
                alt_res = router.search(
                    start_node_id=start_node_id,
                    goal_node_id=goal_node_id,
                    objective=obj,
                    shipment_weight_tons=shipment_weight_tons,
                    shipment_volume_m3=shipment_volume_m3,
                    vehicle_type=vehicle_type,
                    allow_ghats=False
                )
                if alt_res and "-".join(alt_res["path_nodes"]) not in seen_paths:
                    res = alt_res
                    path_key = "-".join(res["path_nodes"])
                    label = f"{label} (Ghat Bypass)"
                    is_ghat = False
                    cost_details = self.estimator.estimate(
                        distance_km=res["total_distance_km"],
                        raw_travel_time_hours=res["estimated_time_hours"],
                        toll_charges_inr=res["toll_charges_inr"],
                        vehicle_type_code=vehicle_type,
                        shipment_weight_tons=shipment_weight_tons,
                        is_ghat_route=False
                    )

            seen_paths.add(path_key)

            route_obj = RouteMetrics(
                route_id=f"ROUTE_{code.upper()}_{start_node_id[:4]}_{goal_node_id[:4]}",
                name=label,
                algorithm=res["algorithm"],
                distance_km=res["total_distance_km"],
                travel_time_hours=cost_details["adjusted_time_hours"],
                total_cost_inr=cost_details["total_transportation_cost_inr"],
                risk_score=res["average_risk_score"],
                is_ghat=is_ghat,
                path_names=res["path_names"],
                waypoints=res["waypoints"],
                edges=res["edges"],
                cost_breakdown=cost_details,
                warnings=warnings
            )
            candidates.append(route_obj)

        return candidates
