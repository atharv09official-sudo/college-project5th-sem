from typing import Optional, Dict, Any
from pydantic import BaseModel


class DecisionGuardEventRequest(BaseModel):
    corridor: str
    cause: str  # e.g., "TRAFFIC_CONGESTION", "VEHICLE_BREAKDOWN", "MONSOON_FLOODING"
    delay_minutes: float
    source_timestamp: Optional[str] = None
    agent_code: Optional[str] = None
    route_base_margin: float = 15000.0


class DecisionGuardResponse(BaseModel):
    decision: str
    reason: str
    replan_triggered: bool
    margin_impact_pct: Optional[float] = None
    cost_delta: Optional[float] = None
    age_minutes: Optional[float] = None
    hash: Optional[str] = None
    action: Optional[str] = None
