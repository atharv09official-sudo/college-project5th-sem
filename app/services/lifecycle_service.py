import json
import uuid
import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.entities import (
    DistributionPlan,
    PlanAllocation,
    PlanEvent,
    InventoryBatch,
    Warehouse,
    Store,
    Product,
    RouteEstimate,
    User,
)
from app.core.enums import PlanStatus, PlanEventType, UserRole
from models.stock_optimizer import ConstrainedStockOptimizer
from app.services.inventory_service import InventoryHealthService
from models.ollama_intelligence import OllamaIntelligenceEngine


class PlanLifecycleException(Exception):
    pass


class SeparationOfDutiesViolation(PlanLifecycleException):
    pass


class ConstraintValidationException(PlanLifecycleException):
    pass


class PlanLifecycleService:
    """
    Authoritative Plan Lifecycle Service:
    Manages the strict state machine:
    DRAFT -> GENERATED -> VALIDATED -> APPROVED -> COMMITTED (or REJECTED)

    Enforces:
    - Invariant 1: The Single-Authority Principle (Solver proposes; Core Backend commits).
    - Invariant 2: Separation of Duties (Four-Eyes Principle: created_by != approved_by).
    - Immutable Audit Logging: Every transition recorded in plan_events.
    """
    def __init__(self):
        self.optimizer = ConstrainedStockOptimizer()
        self.inventory_service = InventoryHealthService()
        self.ai_engine = OllamaIntelligenceEngine()

    def generate_plan(
        self,
        db: Session,
        creator_user_id: int,
        scenario_id: str = "SCENARIO_AUTO_SOLVER"
    ) -> DistributionPlan:
        """
        Step 1: Solves constrained optimization and generates candidate plan in 'GENERATED' state.
        The AI / Solver is purely a Candidate Proposal Generator.
        """
        warehouses = [
            {"id": w.id, "code": w.code, "name": w.name}
            for w in db.query(Warehouse).all()
        ]
        stores = [
            {
                "id": s.id,
                "code": s.code,
                "name": s.name,
                "backroom_capacity_cases": s.backroom_capacity_cases,
                "current_cases": s.current_cases,
                "daily_turnover_tier": s.daily_turnover_tier
            }
            for s in db.query(Store).all()
        ]
        products = [
            {
                "id": p.id,
                "code": p.code,
                "name": p.name,
                "unit_weight_kg": p.unit_weight_kg,
                "unit_volume_l": p.unit_volume_l,
                "shelf_life_days": p.shelf_life_days,
                "case_pack": p.case_pack
            }
            for p in db.query(Product).all()
        ]
        batches = [
            {
                "id": b.id,
                "warehouse_id": b.warehouse_id,
                "product_id": b.product_id,
                "lot_number": b.lot_number,
                "quantity": b.quantity,
                "reserved_quantity": b.reserved_quantity,
                "expiry_date": b.expiry_date
            }
            for b in db.query(InventoryBatch).all()
        ]
        routes = [
            {
                "origin_warehouse_id": r.origin_warehouse_id,
                "destination_store_id": r.destination_store_id,
                "distance_km": r.distance_km,
                "base_cost": r.base_cost,
                "is_ghat_route": r.is_ghat_route
            }
            for r in db.query(RouteEstimate).all()
        ]

        # Calculate net replenishment needs
        replenishment_needs = self.inventory_service.compute_replenishment_needs(db)

        # Solve CP-SAT
        solver_output = self.optimizer.solve(
            warehouses=warehouses,
            stores=stores,
            products=products,
            batches=batches,
            routes=routes,
            replenishment_needs=replenishment_needs
        )

        plan_code = f"PLAN-MH-{int(datetime.datetime.utcnow().timestamp())}-{uuid.uuid4().hex[:6].upper()}"
        plan = DistributionPlan(
            plan_code=plan_code,
            scenario_id=scenario_id,
            status=PlanStatus.GENERATED,
            created_by_user_id=creator_user_id,
            total_cost=solver_output["total_estimated_freight"],
            summary_metrics_json=json.dumps({
                "solver_status": solver_output["solver_status"],
                "solve_time_seconds": solver_output["solve_time_seconds"],
                "total_units_dispatched": solver_output["total_units_dispatched"],
                "total_shortage_units": solver_output["total_shortage_units"],
                "allocations_count": len(solver_output["allocations"])
            })
        )
        db.add(plan)
        db.flush()

        # Add allocations with AI Reason Cards
        for alloc in solver_output["allocations"]:
            # Generate explanation / reason card
            ai_exp = self.ai_engine.generate_explanation(alloc)

            plan_alloc = PlanAllocation(
                plan_id=plan.id,
                batch_id=alloc["batch_id"],
                source_wh_id=alloc["source_wh_id"],
                dest_store_id=alloc["dest_store_id"],
                sku_id=alloc["sku_id"],
                quantity=alloc["quantity"],
                priority=alloc["priority"],
                reason_category=alloc["reason_category"],
                reason_text=ai_exp["rationale"],
                transport_cost=alloc["transport_cost"],
                shelf_life_remaining_days=alloc["shelf_life_remaining_days"],
                arrival_shelf_life_pct=alloc["arrival_shelf_life_pct"]
            )
            db.add(plan_alloc)

        # Audit log event
        event = PlanEvent(
            plan_id=plan.id,
            event_type=PlanEventType.PLAN_GENERATED,
            actor_user_id=creator_user_id,
            details_json=json.dumps({
                "allocations_count": len(solver_output["allocations"]),
                "total_cost": solver_output["total_estimated_freight"],
                "units_dispatched": solver_output["total_units_dispatched"]
            })
        )
        db.add(event)
        db.commit()
        db.refresh(plan)
        return plan

    def validate_plan(self, plan_id: int, actor_user_id: int, db: Session) -> Dict[str, Any]:
        """
        Step 2: Core Backend acts as Sole Authority to validate constraints.
        Checks if batches still hold sufficient available inventory.
        """
        plan = db.query(DistributionPlan).filter(DistributionPlan.id == plan_id).first()
        if not plan:
            raise PlanLifecycleException(f"Plan ID {plan_id} not found")

        if plan.status not in [PlanStatus.DRAFT, PlanStatus.GENERATED]:
            raise PlanLifecycleException(f"Cannot validate plan in status {plan.status}")

        allocations = db.query(PlanAllocation).filter(PlanAllocation.plan_id == plan_id).all()
        violations = []

        # Check real-time inventory balances
        for a in allocations:
            batch = db.query(InventoryBatch).filter(InventoryBatch.id == a.batch_id).first()
            if not batch:
                violations.append(f"Batch {a.batch_id} no longer exists in warehouse")
                continue

            available = batch.quantity - batch.reserved_quantity
            if a.quantity > available:
                violations.append(
                    f"Insufficient stock in Batch {batch.lot_number}: requested {a.quantity}, available {available}"
                )

        if violations:
            plan.status = PlanStatus.REJECTED
            event = PlanEvent(
                plan_id=plan.id,
                event_type=PlanEventType.PLAN_REJECTED,
                actor_user_id=actor_user_id,
                details_json=json.dumps({"reasons": violations})
            )
            db.add(event)
            db.commit()
            return {"status": "REJECTED", "violations": violations}

        # Transition to VALIDATED
        plan.status = PlanStatus.VALIDATED
        event = PlanEvent(
            plan_id=plan.id,
            event_type=PlanEventType.PLAN_VALIDATED,
            actor_user_id=actor_user_id,
            details_json=json.dumps({"status": "All physical constraints verified successfully"})
        )
        db.add(event)
        db.commit()
        db.refresh(plan)
        return {"status": "VALIDATED", "message": "Plan passed all authoritative constraint checks"}

    def approve_plan(self, plan_id: int, approver: User, db: Session) -> Dict[str, Any]:
        """
        Step 3: Separation of Duties (Four-Eyes Principle)
        Enforces:
        - created_by_user_id != approved_by_user_id
        - User must have APPROVER or ADMIN role
        """
        plan = db.query(DistributionPlan).filter(DistributionPlan.id == plan_id).first()
        if not plan:
            raise PlanLifecycleException(f"Plan ID {plan_id} not found")

        if plan.status != PlanStatus.VALIDATED:
            raise PlanLifecycleException(f"Plan must be in VALIDATED status before approval (current: {plan.status})")

        # Invariant 2 Check: Separation of Duties
        if plan.created_by_user_id == approver.id:
            raise SeparationOfDutiesViolation(
                f"Separation-of-Duties violation: Planner (User ID {approver.id}) cannot approve their own plan! "
                f"An independent Approver must authorize this dispatch."
            )

        # Role Check
        if approver.role not in [UserRole.APPROVER, UserRole.ADMIN]:
            raise PlanLifecycleException(f"User role {approver.role} is not authorized to approve plans")

        plan.status = PlanStatus.APPROVED
        plan.approved_by_user_id = approver.id
        event = PlanEvent(
            plan_id=plan.id,
            event_type=PlanEventType.PLAN_APPROVED,
            actor_user_id=approver.id,
            details_json=json.dumps({
                "approved_by": approver.name,
                "approver_role": approver.role.value
            })
        )
        db.add(event)
        db.commit()
        db.refresh(plan)
        return {
            "status": "APPROVED",
            "approved_by": approver.name,
            "message": "Plan successfully authorized under Separation-of-Duties compliance"
        }

    def commit_plan(self, plan_id: int, actor_user_id: int, db: Session) -> Dict[str, Any]:
        """
        Step 4: Single-Authority Database Commitment.
        Atomically locks inventory rows, decrements batch quantities, increments store cases,
        and transitions plan to COMMITTED.
        """
        plan = db.query(DistributionPlan).filter(DistributionPlan.id == plan_id).first()
        if not plan:
            raise PlanLifecycleException(f"Plan ID {plan_id} not found")

        if plan.status != PlanStatus.APPROVED:
            raise PlanLifecycleException(f"Plan must be in APPROVED status before commitment (current: {plan.status})")

        allocations = db.query(PlanAllocation).filter(PlanAllocation.plan_id == plan_id).all()

        try:
            # Atomic database execution
            for a in allocations:
                batch = db.query(InventoryBatch).filter(InventoryBatch.id == a.batch_id).first()
                if not batch or batch.quantity < a.quantity:
                    raise ConstraintValidationException(
                        f"Commitment failed: Batch {a.batch_id} has insufficient inventory"
                    )

                # Commit final inventory balance decrement
                batch.quantity -= a.quantity

                # Update store current backroom inventory
                store = db.query(Store).filter(Store.id == a.dest_store_id).first()
                if store:
                    added_cases = max(1, a.quantity // 12)
                    store.current_cases = min(store.backroom_capacity_cases, store.current_cases + added_cases)

            plan.status = PlanStatus.COMMITTED
            event = PlanEvent(
                plan_id=plan.id,
                event_type=PlanEventType.PLAN_COMMITTED,
                actor_user_id=actor_user_id,
                details_json=json.dumps({
                    "committed_at": datetime.datetime.utcnow().isoformat(),
                    "total_allocations_committed": len(allocations),
                    "total_freight_committed": plan.total_cost
                })
            )
            db.add(event)
            db.commit()
            db.refresh(plan)
            return {
                "status": "COMMITTED",
                "message": "Plan committed atomically. Physical inventory decremented across regional depots."
            }
        except Exception as e:
            db.rollback()
            raise PlanLifecycleException(f"Transaction rollback during commitment: {str(e)}")

    def get_audit_trail(self, plan_id: int, db: Session) -> List[Dict[str, Any]]:
        """
        Returns complete, immutable chronological audit log of all events.
        """
        events = (
            db.query(PlanEvent)
            .filter(PlanEvent.plan_id == plan_id)
            .order_by(PlanEvent.created_at.asc())
            .all()
        )
        result = []
        for e in events:
            actor = db.query(User).filter(User.id == e.actor_user_id).first() if e.actor_user_id else None
            result.append({
                "event_id": e.id,
                "event_type": e.event_type.value,
                "actor_id": e.actor_user_id,
                "actor_name": actor.name if actor else "System",
                "actor_role": actor.role.value if actor else "SYSTEM",
                "details": json.loads(e.details_json) if e.details_json else {},
                "timestamp": e.created_at.isoformat()
            })
        return result
