import os
import json
import math
from typing import Dict, List, Any, Optional, Tuple


class RoadNetworkGraph:
    """
    Module 2: Road Network and Data Loader
    Represents the transportation network as a weighted graph G = (V, E).
    V = Locations, Logistics Hubs, Road Junctions
    E = Connected Road Segments with distance, speed, toll, risk, and restrictions.
    """

    def __init__(self, data_path: Optional[str] = None):
        if data_path is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            data_path = os.path.join(base_dir, "data", "road_network.json")
        
        self.data_path = data_path
        self.nodes: Dict[str, Dict[str, Any]] = {}
        self.edges: Dict[str, Dict[str, Any]] = {}
        self.adjacency: Dict[str, List[Dict[str, Any]]] = {}
        self.alias_map: Dict[str, str] = {}
        
        self.load_network()

    def load_network(self) -> None:
        """Loads and parses the weighted road network graph from JSON."""
        if not os.path.exists(self.data_path):
            raise FileNotFoundError(f"Road network data file not found at {self.data_path}")

        with open(self.data_path, "r", encoding="utf-8") as f:
            raw = json.load(f)

        self.nodes = {n["id"]: n for n in raw.get("nodes", [])}
        self.adjacency = {n_id: [] for n_id in self.nodes}

        # Build alias map for robust search (city, name, lowercase)
        for n_id, n in self.nodes.items():
            self.alias_map[n_id.lower()] = n_id
            self.alias_map[n["name"].lower()] = n_id
            self.alias_map[n["city"].lower()] = n_id

        # Insert edges (bidirectional by default for standard highways)
        for e in raw.get("edges", []):
            edge_id = e["id"]
            u = e["from"]
            v = e["to"]

            if u not in self.nodes or v not in self.nodes:
                continue

            self.edges[edge_id] = e

            # Forward edge
            self.adjacency[u].append({
                "edge_id": edge_id,
                "target": v,
                "distance_km": float(e["distance_km"]),
                "expected_speed_kmh": float(e["expected_speed_kmh"]),
                "toll_charges_inr": float(e.get("toll_charges_inr", 0.0)),
                "risk_factor": float(e.get("risk_factor", 2.0)),
                "max_weight_tons": float(e.get("max_weight_tons", 40.0)),
                "max_volume_m3": float(e.get("max_volume_m3", 75.0)),
                "is_ghat": bool(e.get("is_ghat", False)),
                "allowed_vehicles": e.get("allowed_vehicles", []),
                "corridor_name": e.get("corridor_name", f"{u}-{v}")
            })

            # Backward edge (return trip on standard national/state corridors)
            rev_id = f"{edge_id}_REV"
            self.adjacency[v].append({
                "edge_id": rev_id,
                "target": u,
                "distance_km": float(e["distance_km"]),
                "expected_speed_kmh": float(e["expected_speed_kmh"]),
                "toll_charges_inr": float(e.get("toll_charges_inr", 0.0)),
                "risk_factor": float(e.get("risk_factor", 2.0)),
                "max_weight_tons": float(e.get("max_weight_tons", 40.0)),
                "max_volume_m3": float(e.get("max_volume_m3", 75.0)),
                "is_ghat": bool(e.get("is_ghat", False)),
                "allowed_vehicles": e.get("allowed_vehicles", []),
                "corridor_name": e.get("corridor_name", f"{v}-{u}")
            })

    def resolve_location(self, query: str) -> Optional[str]:
        """
        Resolves location name or ID to an exact node ID.
        Returns node_id or None if unknown.
        """
        if not query:
            return None
        cleaned = query.strip()
        # Direct key match
        if cleaned in self.nodes:
            return cleaned
        
        # Lowercase alias match
        low = cleaned.lower()
        if low in self.alias_map:
            return self.alias_map[low]

        # Substring search in node name or city
        for n_id, n in self.nodes.items():
            if low in n["name"].lower() or low in n["city"].lower() or low in n_id.lower():
                return n_id

        return None

    def get_node(self, node_id: str) -> Optional[Dict[str, Any]]:
        return self.nodes.get(node_id)

    def get_neighbors(self, node_id: str) -> List[Dict[str, Any]]:
        return self.adjacency.get(node_id, [])

    @staticmethod
    def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculates Great-Circle Haversine distance in km between two geographical points.
        Guaranteed to be an admissible lower-bound heuristic for A* search.
        """
        R = 6371.0  # Earth's mean radius in km
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = math.sin(delta_phi / 2.0) ** 2 + \
            math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return round(R * c, 2)

    def heuristic_km(self, current_node_id: str, goal_node_id: str) -> float:
        """Admissible A* heuristic estimating distance to destination."""
        n1 = self.nodes.get(current_node_id)
        n2 = self.nodes.get(goal_node_id)
        if not n1 or not n2:
            return 0.0
        return self.haversine_distance_km(n1["lat"], n1["lng"], n2["lat"], n2["lng"])
