from dataclasses import dataclass
from typing import List, Dict, Any, Tuple, Optional


@dataclass
class RouteMetrics:
    route_id: str
    name: str
    algorithm: str
    distance_km: float
    travel_time_hours: float
    total_cost_inr: float
    risk_score: float
    is_ghat: bool
    path_names: List[str]
    waypoints: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    cost_breakdown: Dict[str, Any]
    warnings: List[str]


class MultiObjectiveScorer:
    """
    Module 7: Multi-Objective Optimization Engine
    Normalizes time, cost, distance, and risk into [0, 1] range.
    Calculates weighted score:
    Score = (W_time * T_norm) + (W_cost * C_norm) + (W_dist * D_norm) + (W_risk * R_norm)
    Subject to: W_time + W_cost + W_dist + W_risk = 1.0
    Lowest score is chosen as the Recommended Route.
    """

    def __init__(
        self,
        w_time: float = 0.35,
        w_cost: float = 0.35,
        w_dist: float = 0.15,
        w_risk: float = 0.15
    ):
        self.w_time = w_time
        self.w_cost = w_cost
        self.w_dist = w_dist
        self.w_risk = w_risk
        self.normalize_weights()

    def normalize_weights(self) -> None:
        """Ensures sum of weights equals 1.0."""
        total = self.w_time + self.w_cost + self.w_dist + self.w_risk
        if total <= 0:
            self.w_time = 0.35
            self.w_cost = 0.35
            self.w_dist = 0.15
            self.w_risk = 0.15
            total = 1.0
        self.w_time = round(self.w_time / total, 4)
        self.w_cost = round(self.w_cost / total, 4)
        self.w_dist = round(self.w_dist / total, 4)
        self.w_risk = round(self.w_risk / total, 4)

    def rank_routes(
        self,
        candidate_routes: List[RouteMetrics],
        deadline_hours: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        Ranks candidate routes using multi-objective scoring.
        Checks delivery deadline constraint and flags warnings.
        Returns sorted list of routes with scores, normalized metrics, and recommendation flag.
        """
        if not candidate_routes:
            return []

        # Extract min and max for normalization
        distances = [r.distance_km for r in candidate_routes]
        times = [r.travel_time_hours for r in candidate_routes]
        costs = [r.total_cost_inr for r in candidate_routes]
        risks = [r.risk_score for r in candidate_routes]

        min_d, max_d = min(distances), max(distances)
        min_t, max_t = min(times), max(times)
        min_c, max_c = min(costs), max(costs)
        min_r, max_r = min(risks), max(risks)

        ranked = []

        for r in candidate_routes:
            # Min-Max Normalization (0.0 = Best, 1.0 = Worst)
            d_norm = 0.0 if max_d == min_d else (r.distance_km - min_d) / (max_d - min_d)
            t_norm = 0.0 if max_t == min_t else (r.travel_time_hours - min_t) / (max_t - min_t)
            c_norm = 0.0 if max_c == min_c else (r.total_cost_inr - min_c) / (max_c - min_c)
            r_norm = 0.0 if max_r == min_r else (r.risk_score - min_r) / (max_r - min_r)

            # Combined Multi-Objective Score (Lower is Better)
            score = (
                (self.w_time * t_norm) +
                (self.w_cost * c_norm) +
                (self.w_dist * d_norm) +
                (self.w_risk * r_norm)
            )

            # Check delivery deadline
            warnings = list(r.warnings)
            deadline_met = True
            if deadline_hours is not None and deadline_hours > 0:
                if r.travel_time_hours > deadline_hours:
                    deadline_met = False
                    delay_margin = round(r.travel_time_hours - deadline_hours, 1)
                    warnings.append(
                        f"DELIVERY DEADLINE EXCEEDED: Route estimated at {r.travel_time_hours:.1f}h exceeds deadline of {deadline_hours:.1f}h by {delay_margin}h."
                    )
                    # Add penalty to score for missing critical delivery deadline
                    score += 0.50

            ranked.append({
                "route_id": r.route_id,
                "name": r.name,
                "algorithm": r.algorithm,
                "distance_km": r.distance_km,
                "travel_time_hours": r.travel_time_hours,
                "total_cost_inr": r.total_cost_inr,
                "risk_score": r.risk_score,
                "is_ghat": r.is_ghat,
                "path_names": r.path_names,
                "waypoints": r.waypoints,
                "cost_breakdown": r.cost_breakdown,
                "warnings": warnings,
                "deadline_met": deadline_met,
                "normalized_metrics": {
                    "time_norm": round(t_norm, 4),
                    "cost_norm": round(c_norm, 4),
                    "dist_norm": round(d_norm, 4),
                    "risk_norm": round(r_norm, 4)
                },
                "multi_objective_score": round(score, 4)
            })

        # Sort by score ascending (lowest score is best)
        ranked.sort(key=lambda x: x["multi_objective_score"])

        # Mark top route as Recommended
        if ranked:
            ranked[0]["is_recommended"] = True
            for r in ranked[1:]:
                r["is_recommended"] = False

        # Generate Explainability Rationale for each route
        for idx, r in enumerate(ranked):
            r["explanation"] = self._generate_explanation(r, ranked, idx)

        return ranked

    def _generate_explanation(
        self,
        route: Dict[str, Any],
        all_routes: List[Dict[str, Any]],
        rank_index: int
    ) -> str:
        """Generates clear, transparent explanation for recommendation or alternative ranking."""
        name = route["name"]
        dist = route["distance_km"]
        time_h = route["travel_time_hours"]
        cost = route["total_cost_inr"]
        risk = route["risk_score"]

        if rank_index == 0:
            reasons = []
            if self.w_time >= 0.30:
                reasons.append(f"optimizes travel time ({time_h:.1f}h)")
            if self.w_cost >= 0.30:
                reasons.append(f"minimizes total freight expenditure (₹{cost:,.2f})")
            if self.w_risk >= 0.20:
                reasons.append(f"maintains lower corridor hazard exposure ({risk:.1f}/10)")
            if self.w_dist >= 0.20:
                reasons.append(f"shortest distance ({dist:.1f} km)")

            reasons_str = ", ".join(reasons) if reasons else "delivers optimal multi-objective balance"
            return (
                f"RECOMMENDED ROUTE: Evaluated as top choice with score {route['multi_objective_score']:.3f}. "
                f"Under your active priority weights (Time: {int(self.w_time*100)}%, Cost: {int(self.w_cost*100)}%, "
                f"Dist: {int(self.w_dist*100)}%, Risk: {int(self.w_risk*100)}%), this path {reasons_str}."
            )
        else:
            top_route = all_routes[0]
            cost_diff = route["total_cost_inr"] - top_route["total_cost_inr"]
            time_diff = route["travel_time_hours"] - top_route["travel_time_hours"]

            cost_str = f"₹{abs(cost_diff):,.2f} " + ("higher" if cost_diff > 0 else "cheaper")
            time_str = f"{abs(time_diff):.1f}h " + ("longer" if time_diff > 0 else "faster")

            return (
                f"ALTERNATIVE OPTION #{rank_index + 1} ({name}): Score {route['multi_objective_score']:.3f}. "
                f"Compared to recommended route, it is {cost_str} and {time_str}."
            )
