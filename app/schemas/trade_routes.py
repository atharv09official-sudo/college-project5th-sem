from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class TradeRouteOptimizePayload(BaseModel):
    origin: str = Field(..., example="Bhiwandi", description="Origin hub, city or junction")
    destination: str = Field(..., example="Kolhapur", description="Destination trade terminal or hub")
    shipment_weight_kg: float = Field(..., gt=0, example=3500.0, description="Payload weight in kilograms")
    shipment_volume_m3: float = Field(..., gt=0, example=15.0, description="Payload volume in cubic meters")
    vehicle_type: str = Field(default="MCV_EICHER_14T", example="MCV_EICHER_14T", description="Designated vehicle class")
    delivery_deadline_hours: Optional[float] = Field(default=None, example=12.0, description="Delivery deadline in hours")
    weight_time: float = Field(default=0.35, ge=0.0, le=1.0, description="Priority weight for Travel Time")
    weight_cost: float = Field(default=0.35, ge=0.0, le=1.0, description="Priority weight for Transportation Cost")
    weight_dist: float = Field(default=0.15, ge=0.0, le=1.0, description="Priority weight for Distance")
    weight_risk: float = Field(default=0.15, ge=0.0, le=1.0, description="Priority weight for Corridor Risk")


class WaypointItem(BaseModel):
    id: str
    name: str
    city: str
    lat: float
    lng: float
    hub_type: str


class CostBreakdownSchema(BaseModel):
    vehicle_used: str
    vehicle_category: str
    distance_km: float
    raw_time_hours: float
    adjusted_time_hours: float
    traffic_delay_minutes: float
    fuel_liters_consumed: float
    fuel_cost_inr: float
    toll_charges_inr: float
    driver_cost_inr: float
    maintenance_cost_inr: float
    total_transportation_cost_inr: float
    fallback_assumptions: List[str]


class RankedRouteSchema(BaseModel):
    route_id: str
    name: str
    algorithm: str
    distance_km: float
    travel_time_hours: float
    total_cost_inr: float
    risk_score: float
    is_ghat: bool
    path_names: List[str]
    waypoints: List[WaypointItem]
    cost_breakdown: CostBreakdownSchema
    warnings: List[str]
    deadline_met: bool
    multi_objective_score: float
    is_recommended: bool
    explanation: str


class TradeRouteOptimizeResponse(BaseModel):
    shipment_request: Dict[str, Any]
    recommended_route: RankedRouteSchema
    ranked_routes: List[RankedRouteSchema]
    predictive_analytics: Dict[str, Any]
    total_candidates_evaluated: int
    academic_credits: Dict[str, Any]


class ReportExportPayload(BaseModel):
    optimization_result: Dict[str, Any]
    format: str = Field(default="json", example="json")  # 'json', 'csv', 'txt'
