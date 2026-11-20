from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from app.core.enums import PlanStatus, AllocationPriority, ReasonCategory


class AllocationDetail(BaseModel):
    id: Optional[int] = None
    batch_id: int
    lot_number: Optional[str] = None
    source_wh_id: int
    source_wh_code: Optional[str] = None
    source_wh_name: Optional[str] = None
    dest_store_id: int
    dest_store_code: Optional[str] = None
    dest_store_name: Optional[str] = None
    sku_id: int
    sku_code: Optional[str] = None
    sku_name: Optional[str] = None
    quantity: int
    priority: str
    reason_category: str
    reason_text: Optional[str] = None
    transport_cost: float
    shelf_life_remaining_days: int
    arrival_shelf_life_pct: float


class PlanGenerateRequest(BaseModel):
    scenario_id: Optional[str] = "SCENARIO_MH_DISPATCH"


class PlanValidationResponse(BaseModel):
    status: str
    message: Optional[str] = None
    violations: Optional[List[str]] = None


class PlanApprovalResponse(BaseModel):
    status: str
    approved_by: str
    message: str


class PlanCommitResponse(BaseModel):
    status: str
    message: str


class PlanEventDetail(BaseModel):
    event_id: int
    event_type: str
    actor_id: Optional[int] = None
    actor_name: Optional[str] = None
    actor_role: Optional[str] = None
    details: Dict[str, Any]
    timestamp: str


class PlanResponse(BaseModel):
    id: int
    plan_code: str
    scenario_id: str
    status: str
    created_by_user_id: int
    creator_name: Optional[str] = None
    approved_by_user_id: Optional[int] = None
    approver_name: Optional[str] = None
    total_cost: float
    summary_metrics: Dict[str, Any]
    created_at: str
    updated_at: Optional[str] = None
    allocations_count: int
    allocations: Optional[List[AllocationDetail]] = None
