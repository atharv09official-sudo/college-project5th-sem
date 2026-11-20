from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.decision_guard import DecisionGuardEventRequest, DecisionGuardResponse
from app.services.decision_guard_service import MaharashtraDecisionGuard

router = APIRouter(prefix="/decision-guard", tags=["Decision Guardrails & Replanning"])
guard = MaharashtraDecisionGuard()


@router.post("/evaluate-event", response_model=DecisionGuardResponse)
def evaluate_disruption_event(
    payload: DecisionGuardEventRequest,
    db: Session = Depends(get_db)
):
    """
    Module 8: Evaluates disruption events against:
    1. Idempotency Check (hash deduplication)
    2. Stale Event Cutoff (>60 min)
    3. Materiality Threshold (<2% route margin impact)
    4. Driver breakdown reassignment
    """
    res = guard.evaluate_event(
        event_payload=payload.dict(),
        route_base_margin=payload.route_base_margin,
        db=db
    )
    return res
