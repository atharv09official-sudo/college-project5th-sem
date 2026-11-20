from enum import Enum


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    PLANNER = "PLANNER"
    APPROVER = "APPROVER"
    OPERATOR = "OPERATOR"
    VIEWER = "VIEWER"


class PlanStatus(str, Enum):
    DRAFT = "DRAFT"
    GENERATED = "GENERATED"
    VALIDATED = "VALIDATED"
    APPROVED = "APPROVED"
    COMMITTED = "COMMITTED"
    REJECTED = "REJECTED"


class PlanEventType(str, Enum):
    PLAN_CREATED = "PLAN_CREATED"
    PLAN_GENERATED = "PLAN_GENERATED"
    PLAN_VALIDATED = "PLAN_VALIDATED"
    PLAN_APPROVED = "PLAN_APPROVED"
    PLAN_COMMITTED = "PLAN_COMMITTED"
    PLAN_REJECTED = "PLAN_REJECTED"
    REPLAN_TRIGGERED = "REPLAN_TRIGGERED"
    ALERT_TRIGGERED = "ALERT_TRIGGERED"


class InventoryHealthStatus(str, Enum):
    CRITICAL_STOCKOUT_RISK = "CRITICAL_STOCKOUT_RISK"  # DOS < 2.0 days (P0)
    LOW_STOCK = "LOW_STOCK"                            # 2.0 <= DOS < 4.0 days (P1)
    BALANCED = "BALANCED"                              # 4.0 <= DOS <= 12.0 days
    OVERSTOCKED_EXCESS = "OVERSTOCKED_EXCESS"          # DOS > 12.0 days


class AllocationPriority(str, Enum):
    P0 = "P0"  # Critical stockout / near-expiry fast move
    P1 = "P1"  # Low stock / regular cycle
    P2 = "P2"  # Buffer / promo replenishment


class ReasonCategory(str, Enum):
    EXPIRY_URGENT = "EXPIRY_URGENT"
    STOCKOUT_PREVENTION = "STOCKOUT_PREVENTION"
    PROMOTION_SURGE = "PROMOTION_SURGE"
    DISTANCE_OPTIMAL = "DISTANCE_OPTIMAL"


class StoreType(str, Enum):
    KIRANA = "KIRANA"
    SUPERMARKET = "SUPERMARKET"
    HYPERMARKET = "HYPERMARKET"


class RoadHazardSeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
