from typing import List, Dict, Any
from pydantic import BaseModel


class StoreHealthItem(BaseModel):
    store_id: int
    store_code: str
    store_name: str
    store_tier: str
    product_id: int
    sku_code: str
    sku_name: str
    on_hand: int
    daily_forecast_demand: float
    days_of_supply: float
    safety_stock: float
    target_stock: float
    net_replenishment_need: int
    health_status: str
    allocation_priority: str


class WarehouseCapacityItem(BaseModel):
    warehouse_id: int
    code: str
    name: str
    capacity_cases: int
    utilized_cases: int
    utilization_pct: float
    batches_count: int


class NetworkHealthSummary(BaseModel):
    total_monitored_nodes: int
    critical_stockout_risk: int
    low_stock: int
    balanced: int
    overstocked_excess: int


class NetworkHealthResponse(BaseModel):
    summary: NetworkHealthSummary
    store_health: List[StoreHealthItem]
    warehouses: List[WarehouseCapacityItem]
