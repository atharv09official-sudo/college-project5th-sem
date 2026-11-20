import heapq
import time
from typing import Dict, List, Any, Optional, Tuple
from .network_graph import RoadNetworkGraph


class RouteConstraintValidator:
    """Validates road segment restrictions against vehicle and shipment properties."""

    @staticmethod
    def is_edge_allowed(
        edge: Dict[str, Any],
        shipment_weight_tons: float,
        shipment_volume_m3: float,
        vehicle_type: str,
        allow_ghat_routes: bool = True
    ) -> Tuple[bool, Optional[str]]:
        """
        Validates vehicle restrictions, weight limits, volume limits, and ghat passes.
        Returns (is_allowed, reason_if_blocked).
        """
        # 1. Weight capacity check
        if shipment_weight_tons > edge["max_weight_tons"]:
            return False, f"Shipment weight ({shipment_weight_tons:.1f}T) exceeds road max limit ({edge['max_weight_tons']:.1f}T)"

        # 2. Volume capacity check
        if shipment_volume_m3 > edge["max_volume_m3"]:
            return False, f"Shipment volume ({shipment_volume_m3:.1f}m3) exceeds corridor limit ({edge['max_volume_m3']:.1f}m3)"

        # 3. Vehicle type allowed on corridor
        allowed_vehicles = edge.get("allowed_vehicles", [])
        if allowed_vehicles and vehicle_type not in allowed_vehicles:
            return False, f"Vehicle type {vehicle_type} not permitted on {edge['corridor_name']}"

        # 4. Severe ghat restriction override if applicable
        if edge.get("is_ghat", False) and not allow_ghat_routes:
            return False, f"Ghat route restricted for {edge['corridor_name']}"

        return True, None


class DijkstraRouter:
    """
    Module 3: Dijkstra's Algorithm
    Finds least-cost path in graph G=(V,E) with non-negative edge weights.
    Supports distance, time, cost, and risk cost functions.
    Enforces vehicle restrictions and capacity rules.
    """

    def __init__(self, graph: RoadNetworkGraph):
        self.graph = graph

    def search(
        self,
        start_node_id: str,
        goal_node_id: str,
        objective: str = "distance",  # 'distance', 'time', 'cost', 'risk'
        shipment_weight_tons: float = 2.0,
        shipment_volume_m3: float = 8.0,
        vehicle_type: str = "LCV_TATA_ACE",
        allow_ghats: bool = True
    ) -> Optional[Dict[str, Any]]:
        start_time = time.perf_counter()
        if start_node_id not in self.graph.nodes or goal_node_id not in self.graph.nodes:
            return None

        # Priority Queue: (accumulated_cost, current_node, current_path, list_of_edges)
        pq: List[Tuple[float, str, List[str], List[Dict[str, Any]]]] = []
        heapq.heappush(pq, (0.0, start_node_id, [start_node_id], []))

        visited_costs: Dict[str, float] = {start_node_id: 0.0}
        nodes_expanded = 0

        while pq:
            current_cost, u, path, edges_traversed = heapq.heappop(pq)
            nodes_expanded += 1

            if u == goal_node_id:
                elapsed_ms = (time.perf_counter() - start_time) * 1000.0
                return self._assemble_route_result(
                    algorithm="Dijkstra",
                    objective=objective,
                    path=path,
                    edges=edges_traversed,
                    nodes_expanded=nodes_expanded,
                    elapsed_ms=elapsed_ms
                )

            if current_cost > visited_costs.get(u, float("inf")):
                continue

            for edge in self.graph.get_neighbors(u):
                v = edge["target"]

                # Constraint checking: vehicle & road restrictions
                allowed, _ = RouteConstraintValidator.is_edge_allowed(
                    edge, shipment_weight_tons, shipment_volume_m3, vehicle_type, allow_ghats
                )
                if not allowed:
                    continue

                # Determine edge cost based on optimization objective
                edge_cost = self._calculate_edge_cost(edge, objective)
                new_cost = current_cost + edge_cost

                if new_cost < visited_costs.get(v, float("inf")):
                    visited_costs[v] = new_cost
                    new_edges = edges_traversed + [edge]
                    new_path = path + [v]
                    heapq.heappush(pq, (new_cost, v, new_path, new_edges))

        return None  # No valid path found under constraints

    @staticmethod
    def _calculate_edge_cost(edge: Dict[str, Any], objective: str) -> float:
        dist = edge["distance_km"]
        speed = max(10.0, edge["expected_speed_kmh"])
        travel_time_hours = dist / speed

        if objective == "distance":
            return dist
        elif objective == "time":
            return travel_time_hours
        elif objective == "cost":
            # Fuel estimate ~ dist * 12 + toll
            fuel_rough = (dist / 6.0) * 94.0
            return fuel_rough + edge["toll_charges_inr"] + (travel_time_hours * 250.0)
        elif objective == "risk":
            # Penalize by risk factor
            return edge["risk_factor"] * dist
        return dist

    def _assemble_route_result(
        self,
        algorithm: str,
        objective: str,
        path: List[str],
        edges: List[Dict[str, Any]],
        nodes_expanded: int,
        elapsed_ms: float
    ) -> Dict[str, Any]:
        total_dist = sum(e["distance_km"] for e in edges)
        total_time_hours = sum(e["distance_km"] / max(10.0, e["expected_speed_kmh"]) for e in edges)
        total_toll = sum(e["toll_charges_inr"] for e in edges)
        avg_risk = sum(e["risk_factor"] for e in edges) / max(1, len(edges))

        waypoints = []
        for n_id in path:
            node = self.graph.nodes[n_id]
            waypoints.append({
                "id": n_id,
                "name": node["name"],
                "city": node["city"],
                "lat": node["lat"],
                "lng": node["lng"],
                "hub_type": node["hub_type"]
            })

        return {
            "algorithm": algorithm,
            "objective": objective,
            "path_nodes": path,
            "path_names": [self.graph.nodes[n]["name"] for n in path],
            "total_distance_km": round(total_dist, 2),
            "estimated_time_hours": round(total_time_hours, 2),
            "toll_charges_inr": round(total_toll, 2),
            "average_risk_score": round(avg_risk, 2),
            "edges": edges,
            "waypoints": waypoints,
            "nodes_expanded": nodes_expanded,
            "execution_time_ms": round(elapsed_ms, 2)
        }


class AStarRouter:
    """
    Module 3: A* Search Algorithm
    f(n) = g(n) + h(n)
    g(n) = actual accumulated cost from source to n
    h(n) = admissible heuristic (Haversine distance divided by max network speed for time)
    Guarantees optimal solution with fewer explored nodes than Dijkstra.
    """

    def __init__(self, graph: RoadNetworkGraph):
        self.graph = graph

    def search(
        self,
        start_node_id: str,
        goal_node_id: str,
        objective: str = "distance",
        shipment_weight_tons: float = 2.0,
        shipment_volume_m3: float = 8.0,
        vehicle_type: str = "LCV_TATA_ACE",
        allow_ghats: bool = True
    ) -> Optional[Dict[str, Any]]:
        start_time = time.perf_counter()
        if start_node_id not in self.graph.nodes or goal_node_id not in self.graph.nodes:
            return None

        # Priority Queue: (f_score, g_score, current_node, path, edges)
        h_start = self._heuristic(start_node_id, goal_node_id, objective)
        pq: List[Tuple[float, float, str, List[str], List[Dict[str, Any]]]] = []
        heapq.heappush(pq, (h_start, 0.0, start_node_id, [start_node_id], []))

        g_scores: Dict[str, float] = {start_node_id: 0.0}
        nodes_expanded = 0

        while pq:
            f, g, u, path, edges_traversed = heapq.heappop(pq)
            nodes_expanded += 1

            if u == goal_node_id:
                elapsed_ms = (time.perf_counter() - start_time) * 1000.0
                return self._assemble_route_result(
                    algorithm="A*",
                    objective=objective,
                    path=path,
                    edges=edges_traversed,
                    nodes_expanded=nodes_expanded,
                    elapsed_ms=elapsed_ms
                )

            if g > g_scores.get(u, float("inf")):
                continue

            for edge in self.graph.get_neighbors(u):
                v = edge["target"]

                # Constraint check
                allowed, _ = RouteConstraintValidator.is_edge_allowed(
                    edge, shipment_weight_tons, shipment_volume_m3, vehicle_type, allow_ghats
                )
                if not allowed:
                    continue

                edge_cost = DijkstraRouter._calculate_edge_cost(edge, objective)
                tentative_g = g + edge_cost

                if tentative_g < g_scores.get(v, float("inf")):
                    g_scores[v] = tentative_g
                    h_v = self._heuristic(v, goal_node_id, objective)
                    f_v = tentative_g + h_v
                    new_edges = edges_traversed + [edge]
                    new_path = path + [v]
                    heapq.heappush(pq, (f_v, tentative_g, v, new_path, new_edges))

        return None

    def _heuristic(self, node_id: str, goal_id: str, objective: str) -> float:
        """
        Admissible heuristic:
        - Distance: Great circle distance (<= road distance)
        - Time: Great circle distance / max theoretical speed (110 km/h) (<= road time)
        - Cost / Risk: Conservative lower bound based on straight line
        """
        h_dist = self.graph.heuristic_km(node_id, goal_id)
        if objective == "distance":
            return h_dist
        elif objective == "time":
            return h_dist / 110.0  # max speed on expressways
        elif objective == "cost":
            return (h_dist / 8.0) * 80.0  # lowest possible fuel rate
        elif objective == "risk":
            return h_dist * 1.0  # min risk multiplier
        return h_dist

    def _assemble_route_result(
        self,
        algorithm: str,
        objective: str,
        path: List[str],
        edges: List[Dict[str, Any]],
        nodes_expanded: int,
        elapsed_ms: float
    ) -> Dict[str, Any]:
        total_dist = sum(e["distance_km"] for e in edges)
        total_time_hours = sum(e["distance_km"] / max(10.0, e["expected_speed_kmh"]) for e in edges)
        total_toll = sum(e["toll_charges_inr"] for e in edges)
        avg_risk = sum(e["risk_factor"] for e in edges) / max(1, len(edges))

        waypoints = []
        for n_id in path:
            node = self.graph.nodes[n_id]
            waypoints.append({
                "id": n_id,
                "name": node["name"],
                "city": node["city"],
                "lat": node["lat"],
                "lng": node["lng"],
                "hub_type": node["hub_type"]
            })

        return {
            "algorithm": algorithm,
            "objective": objective,
            "path_nodes": path,
            "path_names": [self.graph.nodes[n]["name"] for n in path],
            "total_distance_km": round(total_dist, 2),
            "estimated_time_hours": round(total_time_hours, 2),
            "toll_charges_inr": round(total_toll, 2),
            "average_risk_score": round(avg_risk, 2),
            "edges": edges,
            "waypoints": waypoints,
            "nodes_expanded": nodes_expanded,
            "execution_time_ms": round(elapsed_ms, 2)
        }
