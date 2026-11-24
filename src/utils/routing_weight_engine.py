"""
ROUTING WEIGHT ENGINE - SUPPLYGUARD AI
Loads ground-truth routing_data.json and computes dimensional key-point weights
for LLM analysis, Google News RSS searches, and multi-modal risk scoring.
"""

import os
import json
from typing import Dict, Any, List, Optional
from functools import lru_cache

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ROUTING_DATA_PATH = os.path.join(BASE_DIR, "routing_data.json")

# Common aliases mapping to 3-letter ISO code in routing_data.json
COUNTRY_ALIASES = {
    "us": "USA",
    "usa": "USA",
    "united states": "USA",
    "united states of america": "USA",
    "uk": "GBR",
    "gbr": "GBR",
    "great britain": "GBR",
    "united kingdom": "GBR",
    "uae": "ARE",
    "are": "ARE",
    "united arab emirates": "ARE",
    "russia": "RUS",
    "russian federation": "RUS",
    "south korea": "KOR",
    "korea": "KOR",
    "republic of korea": "KOR",
    "holland": "NLD",
    "netherlands": "NLD",
    "the netherlands": "NLD",
    "vietnam": "VNM",
    "afghanistan": "AFG",
    "belarus": "BLR",
}


class RoutingWeightEngine:
    def __init__(self, data_path: str = ROUTING_DATA_PATH):
        self.data_path = data_path
        self._data: Dict[str, Any] = {}
        self._countries_by_code: Dict[str, Dict[str, Any]] = {}
        self._countries_by_name: Dict[str, str] = {}
        self._pairs_by_tuple: Dict[tuple, Dict[str, Any]] = {}
        self._load_data()

    def _load_data(self):
        try:
            if not os.path.exists(self.data_path):
                return
            with open(self.data_path, "r", encoding="utf-8") as f:
                self._data = json.load(f)

            for c in self._data.get("countries", []):
                code = c.get("country_code", "").upper()
                name = c.get("country_name", "")
                self._countries_by_code[code] = c
                self._countries_by_name[name.lower()] = code

            for p in self._data.get("all_pairs", []):
                u = p.get("from_country", "").upper()
                v = p.get("to_country", "").upper()
                self._pairs_by_tuple[(u, v)] = p
        except Exception as e:
            print(f"[RoutingWeightEngine] Warning loading routing data: {e}")

    def normalize_country_code(self, country: str) -> Optional[str]:
        if not country:
            return None
        c_clean = country.strip()
        c_upper = c_clean.upper()

        if c_upper in self._countries_by_code:
            return c_upper

        c_lower = c_clean.lower()
        if c_lower in COUNTRY_ALIASES:
            return COUNTRY_ALIASES[c_lower]

        if c_lower in self._countries_by_name:
            return self._countries_by_name[c_lower]

        for name, code in self._countries_by_name.items():
            if c_lower in name or name in c_lower:
                return code

        return None

    def get_country_name(self, code: str) -> str:
        c = self._countries_by_code.get(code.upper())
        return c.get("country_name", code) if c else code

    def get_corridor_profile(self, from_country: str, to_country: str) -> Optional[Dict[str, Any]]:
        c1 = self.normalize_country_code(from_country)
        c2 = self.normalize_country_code(to_country)
        if not c1 or not c2:
            return None
        return self._pairs_by_tuple.get((c1, c2))

    def compute_routing_weights(self, from_country: str, to_country: str) -> Dict[str, Any]:
        """
        Computes key-point weights based on authoritative routing_data.json.
        Returns weights (0.0 to 1.0) for:
          - sanctions_weight
          - landlocked_transit_weight
          - maritime_chokepoint_weight
          - border_checkpoint_weight
          - air_capacity_weight
        Plus key points, infrastructure summary, and candidate modes.
        """
        pair = self.get_corridor_profile(from_country, to_country)
        c1 = self.normalize_country_code(from_country) or from_country
        c2 = self.normalize_country_code(to_country) or to_country

        if not pair:
            # Fallback for country pair outside the 30 master nations
            return {
                "matched_dataset": False,
                "from_code": c1,
                "to_code": c2,
                "from_name": self.get_country_name(c1),
                "to_name": self.get_country_name(c2),
                "sanctions_weight": 0.0,
                "landlocked_transit_weight": 0.0,
                "maritime_chokepoint_weight": 0.70,
                "border_checkpoint_weight": 0.40,
                "air_capacity_weight": 0.50,
                "primary_mode": "sea",
                "candidate_modes": ["sea", "air"],
                "blocked_modes": [],
                "route_status": "requires_live_validation",
                "infrastructure": {},
                "notes": ["Corridor evaluated under generalized international multimodal standards."],
                "key_points": ["Standard maritime container & bellyhold air cargo corridor."],
            }

        infra = pair.get("infrastructure", {})
        from_landlocked = infra.get("from_landlocked", False)
        to_landlocked = infra.get("to_landlocked", False)
        sanctions_flag = pair.get("sanctions_flag", False)
        route_status = pair.get("route_status", "requires_live_validation")
        primary_mode = pair.get("primary_mode", "sea")
        candidate_modes = pair.get("candidate_modes", [])
        blocked_modes = pair.get("blocked_modes", [])
        neighbors = pair.get("neighbors", False)
        notes = pair.get("notes", [])

        # 1. Sanctions weight
        if sanctions_flag or route_status == "blocked":
            sanctions_weight = 1.0
        else:
            sanctions_weight = 0.0

        # 2. Landlocked transit weight
        if from_landlocked or to_landlocked or primary_mode == "sea_via_transit":
            landlocked_transit_weight = 0.85
        else:
            landlocked_transit_weight = 0.0

        # 3. Maritime chokepoint weight
        if "sea" in candidate_modes or "sea_via_transit" in candidate_modes:
            maritime_chokepoint_weight = 0.90 if primary_mode == "sea" else 0.75
        else:
            maritime_chokepoint_weight = 0.0

        # 4. Border checkpoint weight (highway / trucking)
        if neighbors and "road" in candidate_modes:
            border_checkpoint_weight = 0.85
        elif "road" in candidate_modes:
            border_checkpoint_weight = 0.50
        else:
            border_checkpoint_weight = 0.0

        # 5. Air capacity weight
        if "air" in candidate_modes:
            air_capacity_weight = 0.65 if primary_mode == "air" else 0.50
        else:
            air_capacity_weight = 0.0

        # Build natural key points
        key_points: List[str] = []
        if sanctions_weight >= 0.8:
            key_points.append("CRITICAL: Active trade sanctions / embargo enforce strict compliance checks.")
        if landlocked_transit_weight >= 0.7:
            key_points.append("LANDLOCKED: Mandatory dry port drayage / cross-border rail-road transit required.")
        if maritime_chokepoint_weight >= 0.7:
            from_p = ", ".join(infra.get("from_ports", [])[:2]) or "Origin Seaport"
            to_p = ", ".join(infra.get("to_ports", [])[:2]) or "Destination Seaport"
            key_points.append(f"MARITIME: Deep-sea ocean liner connectivity via {from_p} ➔ {to_p}.")
        if border_checkpoint_weight >= 0.7:
            key_points.append("INLAND BORDER: Contiguous land border enables direct linehaul trucking.")
        if "road" in blocked_modes:
            key_points.append("OCEANIC BREAK: Transcontinental road transit physically blocked by oceanic expanse.")

        return {
            "matched_dataset": True,
            "from_code": c1,
            "to_code": c2,
            "from_name": self.get_country_name(c1),
            "to_name": self.get_country_name(c2),
            "sanctions_weight": sanctions_weight,
            "landlocked_transit_weight": landlocked_transit_weight,
            "maritime_chokepoint_weight": maritime_chokepoint_weight,
            "border_checkpoint_weight": border_checkpoint_weight,
            "air_capacity_weight": air_capacity_weight,
            "primary_mode": primary_mode,
            "candidate_modes": candidate_modes,
            "blocked_modes": blocked_modes,
            "route_status": route_status,
            "neighbors": neighbors,
            "infrastructure": infra,
            "notes": notes,
            "key_points": key_points
        }

    def build_weighted_search_queries(self, from_country: str, to_country: str) -> List[str]:
        """
        Builds prioritized web search queries weighted by routing_data.json key points.
        Guides Google News RSS & LLM searches toward the precise infrastructure & risk signals.
        """
        w = self.compute_routing_weights(from_country, to_country)
        u_name = w["from_name"]
        v_name = w["to_name"]
        infra = w.get("infrastructure", {})

        queries: List[str] = []

        # 1. Sanctions-priority query (Highest priority if sanctions active)
        if w["sanctions_weight"] > 0.5:
            queries.append(f"{u_name} {v_name} trade sanctions embargo freight restrictions compliance")

        # 2. Landlocked / Dry Port Priority query
        if w["landlocked_transit_weight"] > 0.5:
            queries.append(f"{u_name} {v_name} cross-border freight transit dry port customs clearance delay")

        # 3. Port-specific maritime query
        from_ports = infra.get("from_ports", [])
        to_ports = infra.get("to_ports", [])
        port_names = " ".join((from_ports[:2] + to_ports[:2]))
        if w["maritime_chokepoint_weight"] > 0.5:
            if port_names:
                queries.append(f"{u_name} {v_name} {port_names} container shipping port congestion delays")
            else:
                queries.append(f"{u_name} {v_name} sea freight container shipping disruptions dwell")

        # 4. Road Border Checkpoint query
        if w["border_checkpoint_weight"] > 0.5:
            queries.append(f"{u_name} {v_name} border checkpoint trucking highway freight logistics strikes")

        # 5. Air Cargo Airport query
        from_air = infra.get("from_airports", [])
        to_air = infra.get("to_airports", [])
        air_names = " ".join((from_air[:2] + to_air[:2]))
        if w["air_capacity_weight"] > 0.5:
            if air_names:
                queries.append(f"{u_name} {v_name} {air_names} air cargo flight freight disruptions")
            else:
                queries.append(f"{u_name} {v_name} air freight cargo flights delay")

        # Universal fallback query
        if not queries:
            queries.append(f"{u_name} {v_name} port freight shipping delays disruptions")

        return queries

    def format_llm_routing_context(self, from_country: str, to_country: str, external_news: str = "") -> str:
        """
        Formats routing weights and authoritative constraints into a rich prompt context
        for Ollama LLM and explainable AI generation.
        """
        w = self.compute_routing_weights(from_country, to_country)
        infra = w.get("infrastructure", {})

        context_lines = [
            f"CORRIDOR TELEMETRY: {w['from_name']} ({w['from_code']}) ➔ {w['to_name']} ({w['to_code']})",
            f"- Primary Mode: {w['primary_mode'].upper()}, Candidate Modes: {', '.join(w['candidate_modes'])}",
            f"- Blocked Modes: {', '.join(w['blocked_modes']) if w['blocked_modes'] else 'None'}",
            f"- Route Status: {w['route_status'].upper()}",
            f"- Sanctions Alert Weight: {w['sanctions_weight']:.2f} (1.0 = Embargo / Sanctions active)",
            f"- Landlocked Transit Weight: {w['landlocked_transit_weight']:.2f} (Inland feeder requirement)",
            f"- Maritime Chokepoint Weight: {w['maritime_chokepoint_weight']:.2f}",
            f"- Border Checkpoint Weight: {w['border_checkpoint_weight']:.2f}",
            f"- Air Capacity Weight: {w['air_capacity_weight']:.2f}",
        ]

        if infra.get("from_ports") or infra.get("to_ports"):
            context_lines.append(f"- Seaports: Origin [{', '.join(infra.get('from_ports', []))}], Dest [{', '.join(infra.get('to_ports', []))}]")
        if infra.get("from_airports") or infra.get("to_airports"):
            context_lines.append(f"- Airports: Origin [{', '.join(infra.get('from_airports', []))}], Dest [{', '.join(infra.get('to_airports', []))}]")
        if w.get("notes"):
            context_lines.append(f"- Geographic Constraints: {'; '.join(w['notes'])}")
        if w.get("key_points"):
            context_lines.append(f"- Strategic Key Points: {'; '.join(w['key_points'])}")

        if external_news:
            context_lines.append(f"\nREAL-TIME WEB SEARCH NEWS INTELLIGENCE:\n{external_news[:1200]}")

        return "\n".join(context_lines)


# Singleton instance
routing_weight_engine = RoutingWeightEngine()
