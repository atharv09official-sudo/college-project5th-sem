import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.core.enums import UserRole, PlanStatus, PlanEventType, StoreType, AllocationPriority, ReasonCategory, RoadHazardSeverity


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.PLANNER, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    created_plans = relationship("DistributionPlan", foreign_keys="DistributionPlan.created_by_user_id", back_populates="creator")
    approved_plans = relationship("DistributionPlan", foreign_keys="DistributionPlan.approved_by_user_id", back_populates="approver")
    events = relationship("PlanEvent", back_populates="actor")


class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    code = Column(String(50), unique=True, index=True, nullable=False)  # e.g., WH-BHIWANDI
    name = Column(String(150), nullable=False)
    city = Column(String(100), default="Mumbai")
    state = Column(String(100), default="Maharashtra")
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    capacity_cases = Column(Integer, default=50000)

    batches = relationship("InventoryBatch", back_populates="warehouse", cascade="all, delete-orphan")


class Store(Base):
    __tablename__ = "stores"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    code = Column(String(50), unique=True, index=True, nullable=False)  # e.g., STORE-MUM-01
    name = Column(String(150), nullable=False)
    store_type = Column(SQLEnum(StoreType), default=StoreType.KIRANA, nullable=False)
    city = Column(String(100), default="Mumbai")
    state = Column(String(100), default="Maharashtra")
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    backroom_capacity_cases = Column(Integer, default=2000)
    current_cases = Column(Integer, default=500)
    min_shelf_life_pct = Column(Float, default=0.70)  # 70% min shelf life
    daily_turnover_tier = Column(String(10), default="P0")  # P0: High velocity, P1: Medium, P2: Low

    sales_history = relationship("SalesObservation", back_populates="store", cascade="all, delete-orphan")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    code = Column(String(50), unique=True, index=True, nullable=False)  # e.g., SKU-OIL-01
    name = Column(String(150), nullable=False)
    category = Column(String(100), default="Edible Oils")
    unit_weight_kg = Column(Float, default=1.0)
    unit_volume_l = Column(Float, default=1.0)
    shelf_life_days = Column(Integer, default=180)
    mrp = Column(Float, default=150.0)
    case_pack = Column(Integer, default=12)  # Units per case

    batches = relationship("InventoryBatch", back_populates="product", cascade="all, delete-orphan")
    sales_history = relationship("SalesObservation", back_populates="product", cascade="all, delete-orphan")


class InventoryBatch(Base):
    __tablename__ = "inventory_batches"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    lot_number = Column(String(100), nullable=False, index=True)
    quantity = Column(Integer, default=0, nullable=False)  # Available units
    reserved_quantity = Column(Integer, default=0, nullable=False)
    manufacturing_date = Column(DateTime, default=datetime.datetime.utcnow)
    expiry_date = Column(DateTime, nullable=False, index=True)

    warehouse = relationship("Warehouse", back_populates="batches")
    product = relationship("Product", back_populates="batches")
    allocations = relationship("PlanAllocation", back_populates="batch")


class RouteEstimate(Base):
    __tablename__ = "route_estimates"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    origin_warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    destination_store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    corridor_code = Column(String(100), default="NH-48")
    distance_km = Column(Float, nullable=False)
    base_cost = Column(Float, default=500.0)  # Base freight in INR
    is_ghat_route = Column(Boolean, default=False)
    normal_transit_hours = Column(Float, default=4.0)

    origin_warehouse = relationship("Warehouse")
    destination_store = relationship("Store")


class DeliveryAgent(Base):
    __tablename__ = "delivery_agents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    agent_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    vehicle_type = Column(String(50), default="Tata Ace (1.5T)")
    capacity_kg = Column(Float, default=1500.0)
    capacity_l = Column(Float, default=4000.0)
    availability_status = Column(String(30), default="AVAILABLE")  # AVAILABLE, IN_TRANSIT, BREAKDOWN, OFFLINE
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    last_heartbeat = Column(DateTime, default=datetime.datetime.utcnow)


class DistributionPlan(Base):
    __tablename__ = "distribution_plans"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    plan_code = Column(String(60), unique=True, index=True, nullable=False)
    scenario_id = Column(String(60), default="SCENARIO_DEFAULT")
    status = Column(SQLEnum(PlanStatus), default=PlanStatus.DRAFT, nullable=False, index=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    approved_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    total_cost = Column(Float, default=0.0)
    summary_metrics_json = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    creator = relationship("User", foreign_keys=[created_by_user_id], back_populates="created_plans")
    approver = relationship("User", foreign_keys=[approved_by_user_id], back_populates="approved_plans")
    allocations = relationship("PlanAllocation", back_populates="plan", cascade="all, delete-orphan")
    events = relationship("PlanEvent", back_populates="plan", cascade="all, delete-orphan")


class PlanAllocation(Base):
    __tablename__ = "plan_allocations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    plan_id = Column(Integer, ForeignKey("distribution_plans.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("inventory_batches.id"), nullable=False)
    source_wh_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    dest_store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    sku_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    priority = Column(SQLEnum(AllocationPriority), default=AllocationPriority.P1)
    reason_category = Column(SQLEnum(ReasonCategory), default=ReasonCategory.STOCKOUT_PREVENTION)
    reason_text = Column(Text, nullable=True)
    transport_cost = Column(Float, default=0.0)
    shelf_life_remaining_days = Column(Integer, default=60)
    arrival_shelf_life_pct = Column(Float, default=0.75)

    plan = relationship("DistributionPlan", back_populates="allocations")
    batch = relationship("InventoryBatch", back_populates="allocations")
    source_wh = relationship("Warehouse")
    dest_store = relationship("Store")
    product = relationship("Product")


class PlanEvent(Base):
    __tablename__ = "plan_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    plan_id = Column(Integer, ForeignKey("distribution_plans.id"), nullable=False)
    event_type = Column(SQLEnum(PlanEventType), nullable=False)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    details_json = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    plan = relationship("DistributionPlan", back_populates="events")
    actor = relationship("User", back_populates="events")


class SalesObservation(Base):
    __tablename__ = "sales_observations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    observation_date = Column(DateTime, nullable=False, index=True)
    units_sold = Column(Integer, default=0)
    closing_stock = Column(Integer, default=0)
    is_promo = Column(Boolean, default=False)

    store = relationship("Store", back_populates="sales_history")
    product = relationship("Product", back_populates="sales_history")
