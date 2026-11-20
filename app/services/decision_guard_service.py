import hashlib
import datetime
from typing import Dict, Any, Set, Optional
from sqlalchemy.orm import Session
from app.models.entities import DeliveryAgent, DistributionPlan, PlanEvent
from app.core.enums import PlanEventType


class MaharashtraDecisionGuard:
    """
    Module 8: Event-Driven Replanning & Decision Guardrails
    Safeguards against route churn and operational noise in Maharashtra distribution:
    1. Idempotency Check: Hash-based deduplication of events.
    2. Stale Event Cutoff: Events older than 60 minutes rejected/flagged.
    3. Materiality Threshold (<2%): Delays impacting <2% route margin do NOT trigger replanning.
    4. Driver Reassignment: Lost heartbeat or vehicle breakdown unassigns fleet and alerts solver.
    """
    def __init__(
        self,
        stale_cutoff_minutes: int = 60,
        materiality_threshold_pct: float = 0.02  # 2% margin impact
    ):
        self.stale_cutoff_minutes = stale_cutoff_minutes
        self.materiality_threshold_pct = materiality_threshold_pct
        self._processed_event_hashes: Set[str] = set()

    def _compute_hash(self, event_payload: Dict[str, Any]) -> str:
        # Canonical hash of origin, destination, timestamp, and cause
        raw_key = f"{event_payload.get('corridor')}_{event_payload.get('cause')}_{event_payload.get('delay_minutes')}_{event_payload.get('source_timestamp')}"
        return hashlib.sha256(raw_key.encode('utf-8')).hexdigest()

    def evaluate_event(
        self,
        event_payload: Dict[str, Any],
        route_base_margin: float = 15000.0,
        db: Optional[Session] = None
    ) -> Dict[str, Any]:
        """
        Evaluates an incoming disruption event against all 4 guardrails.
        """
        now = datetime.datetime.utcnow()

        # 1. Idempotency Check
        event_hash = self._compute_hash(event_payload)
        if event_hash in self._processed_event_hashes:
            return {
                "decision": "REJECT_DUPLICATE",
                "reason": "Duplicate webhook event detected via hash deduplication.",
                "hash": event_hash,
                "replan_triggered": False
            }
        self._processed_event_hashes.add(event_hash)

        # 2. Stale Event Cutoff
        source_ts_str = event_payload.get("source_timestamp")
        if source_ts_str:
            try:
                source_ts = datetime.datetime.fromisoformat(source_ts_str.replace("Z", ""))
                age_minutes = (now - source_ts).total_seconds() / 60.0
                if age_minutes > self.stale_cutoff_minutes:
                    return {
                        "decision": "MANUAL_REVIEW_STALE",
                        "reason": f"Event is {age_minutes:.1f} minutes old, exceeding the {self.stale_cutoff_minutes}m cutoff.",
                        "age_minutes": round(age_minutes, 1),
                        "replan_triggered": False
                    }
            except Exception:
                pass

        # 3. Driver Breakdown / Lost Heartbeat Check
        cause = str(event_payload.get("cause", "")).upper()
        agent_code = event_payload.get("agent_code")

        if "BREAKDOWN" in cause or "HEARTBEAT_LOST" in cause:
            if db and agent_code:
                agent = db.query(DeliveryAgent).filter(DeliveryAgent.agent_code == agent_code).first()
                if agent:
                    agent.availability_status = "BREAKDOWN"
                    db.commit()

            return {
                "decision": "TRIGGER_DRIVER_REASSIGNMENT",
                "reason": f"Fleet vehicle breakdown detected for {agent_code}. Unassigning dispatches and activating standby fleet.",
                "replan_triggered": True,
                "action": "FLEET_SWAP"
            }

        # 4. Materiality Threshold (<2% route margin)
        # Cost impact of delay: ~₹12/minute of delay
        delay_minutes = float(event_payload.get("delay_minutes", 0.0))
        estimated_cost_impact = delay_minutes * 12.0
        margin_impact_ratio = estimated_cost_impact / max(1.0, route_base_margin)

        if margin_impact_ratio < self.materiality_threshold_pct:
            return {
                "decision": "LOG_DELTA_ONLY",
                "reason": (
                    f"Minor delay ({delay_minutes} min) cost impact (₹{estimated_cost_impact:.2f}, {margin_impact_ratio*100:.2f}%) "
                    f"is below the {self.materiality_threshold_pct*100}% materiality threshold. Replan suppressed to avoid route churn."
                ),
                "margin_impact_pct": round(margin_impact_ratio * 100, 2),
                "cost_delta": round(estimated_cost_impact, 2),
                "replan_triggered": False
            }

        # Substantial disruption (>2% margin impact)
        return {
            "decision": "TRIGGER_DYNAMIC_REPLAN",
            "reason": (
                f"Severe transit delay ({delay_minutes} min) exceeds materiality threshold "
                f"({margin_impact_ratio*100:.2f}% route margin impact). Initiating solver re-allocation."
            ),
            "margin_impact_pct": round(margin_impact_ratio * 100, 2),
            "cost_delta": round(estimated_cost_impact, 2),
            "replan_triggered": True
        }
