import pytest
import sys
import os
import datetime
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.db.init_db import init_db
from app.models.entities import User, Warehouse, Store, Product, InventoryBatch, RouteEstimate
from app.core.enums import UserRole, PlanStatus, AllocationPriority, ReasonCategory
from app.services.lifecycle_service import (
    PlanLifecycleService,
    SeparationOfDutiesViolation,
    PlanLifecycleException,
)
from app.services.inventory_service import InventoryHealthService
from app.services.decision_guard_service import MaharashtraDecisionGuard
from app.services.master_data_service import MasterDataValidatorService
from models.stock_optimizer import ConstrainedStockOptimizer
from models.weekly_quantile_forecaster import (
    WeeklyQuantileForecaster,
    ZeroLeakageChronologicalSplitter,
    FeatureEngineer,
    calculate_wape,
)
from models.anomaly_detector import DemandAnomalyDetector
from models.road_risk_predictor import MaharashtraRoadRiskPredictor
from models.ollama_intelligence import OllamaIntelligenceEngine


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    init_db(force_reset=True)


@pytest.fixture(scope="function")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()


def test_invariant_1_single_authority_and_commitment(db_session):
    """
    Invariant 1: The Optimization/AI Service NEVER directly commits inventory.
    The Core Backend API acts as the Sole Authority to validate and commit final decrements.
    """
    planner = db_session.query(User).filter(User.role == UserRole.PLANNER).first()
    approver = db_session.query(User).filter(User.role == UserRole.APPROVER).first()
    admin = db_session.query(User).filter(User.role == UserRole.ADMIN).first()

    svc = PlanLifecycleService()
    # 1. Proposal Generation (Status: GENERATED)
    plan = svc.generate_plan(db_session, creator_user_id=planner.id)
    assert plan.status == PlanStatus.GENERATED
    assert len(plan.allocations) > 0

    # Pick an allocated batch and check its quantity before commitment
    first_alloc = plan.allocations[0]
    batch = db_session.query(InventoryBatch).filter(InventoryBatch.id == first_alloc.batch_id).first()
    qty_before = batch.quantity

    # 2. Validation
    val_res = svc.validate_plan(plan.id, actor_user_id=planner.id, db=db_session)
    assert val_res["status"] == "VALIDATED"

    # 3. Approval
    svc.approve_plan(plan.id, approver=approver, db=db_session)
    assert plan.status == PlanStatus.APPROVED

    # 4. Sole Authority Commit
    com_res = svc.commit_plan(plan.id, actor_user_id=admin.id, db=db_session)
    assert com_res["status"] == "COMMITTED"

    # Verify inventory was decremented ONLY upon commit
    db_session.refresh(batch)
    assert batch.quantity < qty_before


def test_invariant_2_separation_of_duties(db_session):
    """
    Invariant 2: Separation of Duties (Four-Eyes Principle)
    The system programmatically blocks users from approving their own created plans.
    """
    planner = db_session.query(User).filter(User.role == UserRole.PLANNER).first()
    approver = db_session.query(User).filter(User.role == UserRole.APPROVER).first()

    svc = PlanLifecycleService()
    plan = svc.generate_plan(db_session, creator_user_id=planner.id)
    svc.validate_plan(plan.id, actor_user_id=planner.id, db=db_session)

    # Self-approval by creator must raise SeparationOfDutiesViolation
    with pytest.raises(SeparationOfDutiesViolation) as exc_info:
        svc.approve_plan(plan.id, approver=planner, db=db_session)
    assert "Separation-of-Duties violation" in str(exc_info.value)

    # Legitimate independent approver succeeds
    res = svc.approve_plan(plan.id, approver=approver, db=db_session)
    assert res["status"] == "APPROVED"


def test_invariant_3_zero_leakage_chronological_splits():
    """
    Invariant 3: Zero-Data-Leakage Chronological Splits
    Time series must strictly enforce chronological boundaries.
    Lag and rolling statistics must be computed strictly backwards in time.
    """
    dates = pd.date_range("2026-01-01", periods=60, freq="D")
    df = pd.DataFrame({
        "store_id": [1] * 60,
        "product_id": [101] * 60,
        "observation_date": dates,
        "units_sold": [10 + (i % 7) * 2 for i in range(60)]
    })

    # Feature engineering strictly backwards
    df_feat = FeatureEngineer.extract_features(df, target_col="units_sold")
    assert "lag_1" in df_feat.columns
    assert "rolling_mean_7" in df_feat.columns

    # Verify rolling mean for row t does not include row t's target
    # In row 10, rolling_mean_7 must equal average of rows 3 to 9
    expected_mean = df["units_sold"].iloc[3:10].mean()
    actual_mean = df_feat["rolling_mean_7"].iloc[10]
    assert np.isclose(expected_mean, actual_mean, atol=1e-3)

    # Chronological Split
    train, val, test = ZeroLeakageChronologicalSplitter.split(df_feat, train_ratio=0.7, val_ratio=0.15)
    assert train["observation_date"].max() < val["observation_date"].min()
    assert val["observation_date"].max() < test["observation_date"].min()


def test_invariant_4_soft_slack_feasibility_guarantee():
    """
    Invariant 4: Soft-Slack Feasibility Guarantee
    Solvers must NEVER crash or return INFEASIBLE in severe stockout situations.
    """
    optimizer = ConstrainedStockOptimizer(shortage_penalty=150.0)

    # Single warehouse with only 10 units
    warehouses = [{"id": 1, "code": "WH-TEST", "name": "Small Depot"}]
    stores = [{"id": 1, "code": "STORE-TEST", "name": "Kirana 1", "backroom_capacity_cases": 1000, "current_cases": 10, "daily_turnover_tier": "P0"}]
    products = [{"id": 1, "code": "SKU-OIL", "name": "Oil 1L", "unit_weight_kg": 1.0, "unit_volume_l": 1.0, "shelf_life_days": 180, "case_pack": 12}]
    batches = [{
        "id": 10,
        "warehouse_id": 1,
        "product_id": 1,
        "lot_number": "LOT-MINI",
        "quantity": 10,
        "reserved_quantity": 0,
        "expiry_date": datetime.datetime.utcnow() + datetime.timedelta(days=90)
    }]
    routes = [{"origin_warehouse_id": 1, "destination_store_id": 1, "distance_km": 20.0, "base_cost": 300.0}]

    # Store demands 500 units (massive deficit of 490 units)
    replenishment_needs = {(1, 1): 500}

    res = optimizer.solve(warehouses, stores, products, batches, routes, replenishment_needs)
    # Feasibility must be 100% preserved
    assert res["is_feasible"] is True
    assert res["total_units_dispatched"] == 10
    assert res["total_shortage_units"] == 490


def test_invariant_5_deterministic_ai_fallback():
    """
    Invariant 5: Deterministic Fallback for Generative AI
    Local LLM explanations must wrap with strict timeouts and automatic deterministic rule fallback.
    """
    # Point to invalid port to guarantee offline connection error
    ai_engine = OllamaIntelligenceEngine(base_url="http://localhost:9999", timeout_seconds=1)
    allocation_info = {
        "dest_store_code": "STORE-MUM-01",
        "dest_store_name": "Dadar Super Kirana",
        "sku_name": "Fortune Sunflower Oil 1L",
        "quantity": 60,
        "lot_number": "LOT-2026-B8",
        "source_wh_code": "WH-BHIWANDI",
        "shelf_life_remaining_days": 45,
        "arrival_shelf_life_pct": 78.0,
        "transport_cost": 320.0,
        "reason_category": "EXPIRY_URGENT",
        "days_of_supply": 1.2
    }

    res = ai_engine.generate_explanation(allocation_info)
    assert res["fallback_used"] is True
    assert res["engine"] == "DETERMINISTIC_RULE_TEMPLATE"
    assert "Dadar Super Kirana" in res["rationale"]
    assert "LOT-2026-B8" in res["rationale"]


def test_module_1_and_4_inventory_health_and_dos(db_session):
    """
    Module 1 & 4: Days of Supply (DOS) and Health Classifications
    DOS = On Hand / max(0.1, Daily Forecast Demand)
    """
    svc = InventoryHealthService()
    health = svc.get_network_health(db_session)
    assert "summary" in health
    assert "store_health" in health
    assert len(health["store_health"]) > 0

    first = health["store_health"][0]
    expected_dos = first["on_hand"] / max(0.1, first["daily_forecast_demand"])
    assert np.isclose(first["days_of_supply"], expected_dos, atol=0.1)
    assert first["health_status"] in ["CRITICAL_STOCKOUT_RISK", "LOW_STOCK", "BALANCED", "OVERSTOCKED_EXCESS"]


def test_module_3_demand_anomaly_detector():
    """
    Module 3: Demand Anomaly & Shock Detection
    IsolationForest(contamination=0.03) clamping spikes to 95th percentile cap.
    """
    rng = np.random.RandomState(42)
    normal_demand = rng.normal(30, 5, 200).tolist()
    # Insert 3 extreme promotional spikes
    spikes = [250, 310, 400]
    data = normal_demand + spikes

    df = pd.DataFrame({"units_sold": data})
    detector = DemandAnomalyDetector(contamination=0.03, random_state=42)
    df_clean, summary = detector.fit_detect_and_clamp(df, target_col="units_sold")

    assert summary["demand_spikes_clamped"] > 0
    assert df_clean["clamped_demand"].max() <= summary["p95_cap_value"]


def test_module_6_fefo_shelf_life_protection():
    """
    Module 6: FEFO Shelf-Life Protection
    Arrival shelf life ratio >= 70%. Disqualify <70% for slow stores.
    Near-expiry (30-60 days) routed to high-turnover P0 stores.
    """
    optimizer = ConstrainedStockOptimizer(min_arrival_shelf_life_ratio=0.70)
    now = datetime.datetime.utcnow()

    # Create 2 batches: one sub-70% (20 days remaining of 180 total shelf life), one fresh (140 days)
    batches = [
        {
            "id": 1,
            "warehouse_id": 1,
            "product_id": 1,
            "lot_number": "LOT-OLD",
            "quantity": 100,
            "reserved_quantity": 0,
            "expiry_date": now + datetime.timedelta(days=20)  # 20/180 = 11% shelf life
        },
        {
            "id": 2,
            "warehouse_id": 1,
            "product_id": 1,
            "lot_number": "LOT-FRESH",
            "quantity": 100,
            "reserved_quantity": 0,
            "expiry_date": now + datetime.timedelta(days=140)  # 140/180 = 77% shelf life
        }
    ]

    # Matching for slow store (P2) must disqualify LOT-OLD and select LOT-FRESH
    matched = optimizer._fefo_match_batches(
        batches=batches,
        wh_id=1,
        sku_id=1,
        target_qty=50,
        store_tier="P2",
        total_shelf_life_days=180,
        now=now
    )
    assert len(matched) == 1
    assert matched[0]["lot_number"] == "LOT-FRESH"


def test_module_7_maharashtra_road_risk():
    """
    Module 7: Western Ghats transit delay predictor and dynamic surcharge formula.
    """
    predictor = MaharashtraRoadRiskPredictor(base_diesel_price=92.50)
    res = predictor.predict(
        rainfall_mm=85.0,
        visibility_km=3.0,
        pothole_or_surface_risk_index=0.8,
        waterlogging_flag=1,
        traffic_congestion_index=0.9,
        is_ghat_route=True,
        base_freight=2000.0,
        current_diesel_price=95.0
    )
    assert res["hazard_severity"] in ["MEDIUM", "HIGH"]
    assert res["predicted_delay_minutes"] > 30.0
    assert res["adjusted_freight"] > 2000.0
    assert res["surcharge_pct"] > 0


def test_module_8_maharashtra_decision_guard():
    """
    Module 8: Decision Guardrails
    - Idempotency check rejects duplicate
    - Stale cutoff (>60 min)
    - Materiality threshold (<2%)
    - Driver breakdown reassignment
    """
    guard = MaharashtraDecisionGuard(stale_cutoff_minutes=60, materiality_threshold_pct=0.02)

    event = {
        "corridor": "NH-48 Khandala",
        "cause": "TRAFFIC_JAM",
        "delay_minutes": 10.0,
        "source_timestamp": datetime.datetime.utcnow().isoformat()
    }
    # Minor delay impact: 10 min * ₹12 = ₹120 on ₹15,000 margin = 0.8% (< 2%)
    res1 = guard.evaluate_event(event, route_base_margin=15000.0)
    assert res1["decision"] == "LOG_DELTA_ONLY"
    assert res1["replan_triggered"] is False

    # Immediate duplicate event must be rejected
    res_dup = guard.evaluate_event(event, route_base_margin=15000.0)
    assert res_dup["decision"] == "REJECT_DUPLICATE"

    # Stale event (>60 min)
    stale_event = {
        "corridor": "Kasara Ghat",
        "cause": "POTHOLE",
        "delay_minutes": 40.0,
        "source_timestamp": (datetime.datetime.utcnow() - datetime.timedelta(minutes=90)).isoformat()
    }
    res_stale = guard.evaluate_event(stale_event)
    assert res_stale["decision"] == "MANUAL_REVIEW_STALE"

    # Driver breakdown must trigger fleet swap
    breakdown_event = {
        "corridor": "Bhor Ghat",
        "cause": "VEHICLE_BREAKDOWN",
        "delay_minutes": 120.0,
        "agent_code": "FLEET-MH-01",
        "source_timestamp": datetime.datetime.utcnow().isoformat()
    }
    res_bd = guard.evaluate_event(breakdown_event)
    assert res_bd["decision"] == "TRIGGER_DRIVER_REASSIGNMENT"
    assert res_bd["replan_triggered"] is True


def test_module_10_master_data_csv_validator(db_session):
    """
    Module 10: Import Studio Pre-Flight CSV Validator
    """
    validator = MasterDataValidatorService()

    # Valid CSV
    valid_csv = (
        "code,name,city,state,latitude,longitude,capacity_cases\n"
        "WH-TEST-01,Test Depot,Mumbai,Maharashtra,19.0,72.8,1000\n"
    )
    res_valid = validator.validate_csv(valid_csv, dataset_type="warehouses", db=db_session)
    assert res_valid["is_valid"] is True
    assert res_valid["total_rows"] == 1

    # Invalid CSV: missing headers & negative capacity
    invalid_csv = (
        "code,city\n"
        "WH-TEST-02,Mumbai\n"
    )
    res_inv = validator.validate_csv(invalid_csv, dataset_type="warehouses", db=db_session)
    assert res_inv["is_valid"] is False
    assert len(res_inv["errors"]) > 0
