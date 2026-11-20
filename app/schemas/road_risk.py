from typing import Optional
from pydantic import BaseModel


class RoadRiskRequest(BaseModel):
    rainfall_mm: float = 25.0
    visibility_km: float = 8.0
    pothole_or_surface_risk_index: float = 0.35
    waterlogging_flag: int = 0
    traffic_congestion_index: float = 0.50
    is_ghat_route: bool = True
    base_freight: float = 2500.0
    current_diesel_price: float = 94.0


class RoadRiskResponse(BaseModel):
    predicted_delay_minutes: float
    predicted_delay_hours: float
    hazard_severity: str
    hazard_confidence: float
    is_ghat_corridor: bool
    base_freight: float
    adjusted_freight: float
    fuel_surcharge: float
    delay_surcharge: float
    surcharge_pct: float
    recommendation: str
