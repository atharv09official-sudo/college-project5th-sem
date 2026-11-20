import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.db.base import Base


class ShipmentPlanRequest(Base):
    """
    Module 10: Database Management - Shipment Requests
    Stores shipment parameters, vehicle preferences, deadlines, and multi-objective weights.
    """
    __tablename__ = "shipment_plan_requests"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    request_code = Column(String(60), unique=True, index=True, nullable=False)
    origin_node_id = Column(String(50), nullable=False)
    destination_node_id = Column(String(50), nullable=False)
    origin_name = Column(String(150), nullable=False)
    destination_name = Column(String(150), nullable=False)
    shipment_weight_kg = Column(Float, nullable=False)
    shipment_volume_m3 = Column(Float, nullable=False)
    vehicle_type = Column(String(50), default="LCV_TATA_ACE", nullable=False)
    delivery_deadline_hours = Column(Float, nullable=True)
    weight_time = Column(Float, default=0.35)
    weight_cost = Column(Float, default=0.35)
    weight_dist = Column(Float, default=0.15)
    weight_risk = Column(Float, default=0.15)
    status = Column(String(30), default="OPTIMIZED")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # One request has multiple candidate route results
    routes = relationship("TradeRouteResult", back_populates="request", cascade="all, delete-orphan")


class TradeRouteResult(Base):
    """
    Module 10: Database Management - Route Results
    Stores candidate routes, metrics, algorithm used, multi-objective score, and waypoints.
    """
    __tablename__ = "trade_route_results"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    request_id = Column(Integer, ForeignKey("shipment_plan_requests.id"), nullable=False)
    route_type = Column(String(50), nullable=False)  # 'RECOMMENDED', 'ALTERNATIVE_1', etc.
    route_name = Column(String(150), nullable=False)
    algorithm_used = Column(String(30), default="A*")
    distance_km = Column(Float, nullable=False)
    travel_time_hours = Column(Float, nullable=False)
    total_cost_inr = Column(Float, nullable=False)
    toll_charges_inr = Column(Float, default=0.0)
    fuel_cost_inr = Column(Float, default=0.0)
    risk_score = Column(Float, default=2.0)
    multi_objective_score = Column(Float, default=0.0)
    is_recommended = Column(Boolean, default=False)
    waypoints_json = Column(Text, default="[]")
    warnings_json = Column(Text, default="[]")
    explanation = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    request = relationship("ShipmentPlanRequest", back_populates="routes")
