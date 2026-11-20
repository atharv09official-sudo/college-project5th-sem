import math
import numpy as np
from typing import Dict, List, Any, Tuple
from sqlalchemy.orm import Session
from app.models.entities import Store, Product, InventoryBatch, SalesObservation, Warehouse
from app.core.enums import InventoryHealthStatus, AllocationPriority


class InventoryHealthService:
    """
    Module 1 & 4: Multi-Echelon Visibility, DOS Health, and Dynamic Replenishment
    """
    def __init__(self, service_level_z: float = 1.65):
        self.z = service_level_z  # 95% service level

    def get_network_health(self, db: Session) -> Dict[str, Any]:
        """
        Computes store-level Days of Supply (DOS) and classifications across the network.
        Formula: DOS = On Hand / max(0.1, Daily Forecast Demand)
        """
        stores = db.query(Store).all()
        products = db.query(Product).all()
        warehouses = db.query(Warehouse).all()

        store_health_records = []
        critical_count = 0
        low_count = 0
        balanced_count = 0
        overstocked_count = 0

        # Calculate daily demand and standard deviation from recent sales
        for s in stores:
            for p in products:
                # Query last 30 days sales
                sales = (
                    db.query(SalesObservation.units_sold)
                    .filter(SalesObservation.store_id == s.id, SalesObservation.product_id == p.id)
                    .order_by(SalesObservation.observation_date.desc())
                    .limit(30)
                    .all()
                )
                units = [r[0] for r in sales] if sales else [25]
                daily_demand = float(np.mean(units)) if units else 20.0
                sigma = float(np.std(units)) if len(units) > 1 else 5.0

                # On-hand at store: estimated from closing stock or proportion
                last_obs = (
                    db.query(SalesObservation.closing_stock)
                    .filter(SalesObservation.store_id == s.id, SalesObservation.product_id == p.id)
                    .order_by(SalesObservation.observation_date.desc())
                    .first()
                )
                on_hand = last_obs[0] if last_obs else 35

                # Lead time: ~2 days in Maharashtra regional supply
                lead_time_days = 2.0
                safety_stock = self.z * sigma * math.sqrt(lead_time_days)
                target_stock = daily_demand * 5.0 + safety_stock  # 5 days cycle target
                in_transit = 0

                # Net Replenishment = max(0, Target - OnHand - InTransit)
                replenishment_need = max(0, int(round(target_stock - on_hand - in_transit)))

                # DOS calculation
                dos = on_hand / max(0.1, daily_demand)

                # Classification
                if dos < 2.0:
                    health_status = InventoryHealthStatus.CRITICAL_STOCKOUT_RISK
                    priority = AllocationPriority.P0
                    critical_count += 1
                elif dos < 4.0:
                    health_status = InventoryHealthStatus.LOW_STOCK
                    priority = AllocationPriority.P1
                    low_count += 1
                elif dos <= 12.0:
                    health_status = InventoryHealthStatus.BALANCED
                    priority = AllocationPriority.P2
                    balanced_count += 1
                else:
                    health_status = InventoryHealthStatus.OVERSTOCKED_EXCESS
                    priority = AllocationPriority.P2
                    overstocked_count += 1

                store_health_records.append({
                    "store_id": s.id,
                    "store_code": s.code,
                    "store_name": s.name,
                    "store_tier": s.daily_turnover_tier,
                    "product_id": p.id,
                    "sku_code": p.code,
                    "sku_name": p.name,
                    "on_hand": on_hand,
                    "daily_forecast_demand": round(daily_demand, 1),
                    "days_of_supply": round(dos, 1),
                    "safety_stock": round(safety_stock, 1),
                    "target_stock": round(target_stock, 1),
                    "net_replenishment_need": replenishment_need,
                    "health_status": health_status.value,
                    "allocation_priority": priority.value,
                })

        # Warehouse depot capacity utilization
        warehouse_stats = []
        for w in warehouses:
            batches = db.query(InventoryBatch).filter(InventoryBatch.warehouse_id == w.id).all()
            total_cases = sum(b.quantity // 12 for b in batches)
            utilization = round((total_cases / max(1, w.capacity_cases)) * 100, 1)
            warehouse_stats.append({
                "warehouse_id": w.id,
                "code": w.code,
                "name": w.name,
                "capacity_cases": w.capacity_cases,
                "utilized_cases": total_cases,
                "utilization_pct": utilization,
                "batches_count": len(batches)
            })

        return {
            "summary": {
                "total_monitored_nodes": len(store_health_records),
                "critical_stockout_risk": critical_count,
                "low_stock": low_count,
                "balanced": balanced_count,
                "overstocked_excess": overstocked_count,
            },
            "store_health": store_health_records,
            "warehouses": warehouse_stats
        }

    def compute_replenishment_needs(self, db: Session) -> Dict[Tuple[int, int], int]:
        """
        Computes net replenishment need for each (store_id, sku_id).
        """
        health = self.get_network_health(db)
        needs = {}
        for item in health["store_health"]:
            needs[(item["store_id"], item["product_id"])] = item["net_replenishment_need"]
        return needs
