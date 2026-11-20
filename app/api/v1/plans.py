import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.entities import DistributionPlan, PlanAllocation, User
from app.core.enums import PlanStatus
from app.schemas.plan import (
    PlanGenerateRequest,
    PlanValidationResponse,
    PlanApprovalResponse,
    PlanCommitResponse,
    PlanResponse,
    AllocationDetail,
    PlanEventDetail,
)
from app.services.lifecycle_service import (
    PlanLifecycleService,
    PlanLifecycleException,
    SeparationOfDutiesViolation,
    ConstraintValidationException,
)
from app.api.v1.deps import get_current_user

router = APIRouter(prefix="/plans", tags=["Distribution Plans Lifecycle"])
lifecycle_svc = PlanLifecycleService()


@router.get("/", response_model=List[PlanResponse])
def list_plans(
    status_filter: Optional[PlanStatus] = Query(None, alias="status"),
    db: Session = Depends(get_db)
):
    query = db.query(DistributionPlan).order_by(DistributionPlan.created_at.desc())
    if status_filter:
        query = query.filter(DistributionPlan.status == status_filter)
    plans = query.all()

    result = []
    for p in plans:
        creator = db.query(User).filter(User.id == p.created_by_user_id).first()
        approver = db.query(User).filter(User.id == p.approved_by_user_id).first() if p.approved_by_user_id else None
        metrics = json.loads(p.summary_metrics_json) if p.summary_metrics_json else {}

        result.append({
            "id": p.id,
            "plan_code": p.plan_code,
            "scenario_id": p.scenario_id,
            "status": p.status.value,
            "created_by_user_id": p.created_by_user_id,
            "creator_name": creator.name if creator else "System",
            "approved_by_user_id": p.approved_by_user_id,
            "approver_name": approver.name if approver else None,
            "total_cost": p.total_cost,
            "summary_metrics": metrics,
            "created_at": p.created_at.isoformat(),
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
            "allocations_count": len(p.allocations),
            "allocations": None  # Omitted on list view for efficiency
        })
    return result


@router.get("/{plan_id}", response_model=PlanResponse)
def get_plan_detail(plan_id: int, db: Session = Depends(get_db)):
    p = db.query(DistributionPlan).filter(DistributionPlan.id == plan_id).first()
    if not p:
        raise HTTPException(status_code=404, detail=f"Plan {plan_id} not found")

    creator = db.query(User).filter(User.id == p.created_by_user_id).first()
    approver = db.query(User).filter(User.id == p.approved_by_user_id).first() if p.approved_by_user_id else None
    metrics = json.loads(p.summary_metrics_json) if p.summary_metrics_json else {}

    allocations_list = []
    for a in p.allocations:
        allocations_list.append({
            "id": a.id,
            "batch_id": a.batch_id,
            "lot_number": a.batch.lot_number if a.batch else f"LOT-{a.batch_id}",
            "source_wh_id": a.source_wh_id,
            "source_wh_code": a.source_wh.code if a.source_wh else None,
            "source_wh_name": a.source_wh.name if a.source_wh else None,
            "dest_store_id": a.dest_store_id,
            "dest_store_code": a.dest_store.code if a.dest_store else None,
            "dest_store_name": a.dest_store.name if a.dest_store else None,
            "sku_id": a.sku_id,
            "sku_code": a.product.code if a.product else None,
            "sku_name": a.product.name if a.product else None,
            "quantity": a.quantity,
            "priority": a.priority.value,
            "reason_category": a.reason_category.value,
            "reason_text": a.reason_text,
            "transport_cost": a.transport_cost,
            "shelf_life_remaining_days": a.shelf_life_remaining_days,
            "arrival_shelf_life_pct": a.arrival_shelf_life_pct
        })

    return {
        "id": p.id,
        "plan_code": p.plan_code,
        "scenario_id": p.scenario_id,
        "status": p.status.value,
        "created_by_user_id": p.created_by_user_id,
        "creator_name": creator.name if creator else "System",
        "approved_by_user_id": p.approved_by_user_id,
        "approver_name": approver.name if approver else None,
        "total_cost": p.total_cost,
        "summary_metrics": metrics,
        "created_at": p.created_at.isoformat(),
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        "allocations_count": len(p.allocations),
        "allocations": allocations_list
    }


@router.post("/generate", response_model=PlanResponse)
def generate_plan(
    payload: PlanGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        plan = lifecycle_svc.generate_plan(
            db=db,
            creator_user_id=current_user.id,
            scenario_id=payload.scenario_id or "SCENARIO_AUTO_SOLVER"
        )
        return get_plan_detail(plan.id, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Solver execution failed: {str(e)}")


@router.post("/{plan_id}/validate", response_model=PlanValidationResponse)
def validate_plan(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        res = lifecycle_svc.validate_plan(plan_id=plan_id, actor_user_id=current_user.id, db=db)
        return res
    except PlanLifecycleException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{plan_id}/approve", response_model=PlanApprovalResponse)
def approve_plan(
    plan_id: int,
    approver_user_id: Optional[int] = Query(None, description="Simulate specific approver for 4-eyes testing"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Support specifying approver_user_id in query for interactive demonstration
    acting_approver = current_user
    if approver_user_id:
        custom_approver = db.query(User).filter(User.id == approver_user_id).first()
        if custom_approver:
            acting_approver = custom_approver

    try:
        res = lifecycle_svc.approve_plan(plan_id=plan_id, approver=acting_approver, db=db)
        return res
    except SeparationOfDutiesViolation as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except PlanLifecycleException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{plan_id}/commit", response_model=PlanCommitResponse)
def commit_plan(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        res = lifecycle_svc.commit_plan(plan_id=plan_id, actor_user_id=current_user.id, db=db)
        return res
    except PlanLifecycleException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{plan_id}/audit", response_model=List[PlanEventDetail])
def get_plan_audit_trail(plan_id: int, db: Session = Depends(get_db)):
    events = lifecycle_svc.get_audit_trail(plan_id=plan_id, db=db)
    return events
