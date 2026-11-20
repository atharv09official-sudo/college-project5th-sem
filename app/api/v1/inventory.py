from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.entities import Warehouse, Store, InventoryBatch, Product
from app.services.inventory_service import InventoryHealthService
from app.schemas.inventory import NetworkHealthResponse

router = APIRouter(prefix="/inventory", tags=["Multi-Echelon Inventory Health"])
health_svc = InventoryHealthService()


@router.get("/health", response_model=NetworkHealthResponse)
def get_inventory_health(db: Session = Depends(get_db)):
    """
    Module 1: Real-time multi-echelon inventory visibility and Days of Supply (DOS) monitoring.
    """
    return health_svc.get_network_health(db)


@router.get("/warehouses")
def list_warehouses(db: Session = Depends(get_db)):
    warehouses = db.query(Warehouse).all()
    res = []
    for w in warehouses:
        batches = db.query(InventoryBatch).filter(InventoryBatch.warehouse_id == w.id).all()
        total_units = sum(b.quantity for b in batches)
        res.append({
            "id": w.id,
            "code": w.code,
            "name": w.name,
            "city": w.city,
            "state": w.state,
            "latitude": w.latitude,
            "longitude": w.longitude,
            "capacity_cases": w.capacity_cases,
            "total_inventory_units": total_units,
            "batches_count": len(batches)
        })
    return res


@router.get("/stores")
def list_stores(db: Session = Depends(get_db)):
    stores = db.query(Store).all()
    return [
        {
            "id": s.id,
            "code": s.code,
            "name": s.name,
            "store_type": s.store_type.value,
            "city": s.city,
            "state": s.state,
            "latitude": s.latitude,
            "longitude": s.longitude,
            "backroom_capacity_cases": s.backroom_capacity_cases,
            "current_cases": s.current_cases,
            "turnover_tier": s.daily_turnover_tier,
            "min_shelf_life_pct": s.min_shelf_life_pct
        }
        for s in stores
    ]


@router.get("/batches")
def list_inventory_batches(db: Session = Depends(get_db)):
    batches = db.query(InventoryBatch).all()
    res = []
    for b in batches:
        res.append({
            "id": b.id,
            "warehouse_id": b.warehouse_id,
            "warehouse_code": b.warehouse.code if b.warehouse else None,
            "product_id": b.product_id,
            "product_code": b.product.code if b.product else None,
            "product_name": b.product.name if b.product else None,
            "lot_number": b.lot_number,
            "quantity": b.quantity,
            "reserved_quantity": b.reserved_quantity,
            "manufacturing_date": b.manufacturing_date.isoformat() if b.manufacturing_date else None,
            "expiry_date": b.expiry_date.isoformat() if b.expiry_date else None,
        })
    return res
