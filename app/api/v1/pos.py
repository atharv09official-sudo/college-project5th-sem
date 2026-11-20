import datetime
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.entities import Store, Product, SalesObservation
from app.schemas.pos import POSSaleItem, POSSyncBatchRequest, POSSyncBatchResponse

router = APIRouter(prefix="/pos", tags=["Kirana POS Portal"])


@router.get("/inventory/{store_id}")
def get_store_pos_inventory(store_id: int, db: Session = Depends(get_db)):
    """
    Module 10: Kirana POS inventory with visual shelf-life status badges:
    - GREEN: > 90 days remaining
    - AMBER: 30 - 90 days remaining
    - RED: < 30 days remaining
    """
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail=f"Store {store_id} not found")

    products = db.query(Product).all()
    inventory_items = []

    now = datetime.datetime.utcnow()

    for p in products:
        # Get latest closing stock
        last_obs = (
            db.query(SalesObservation)
            .filter(SalesObservation.store_id == store_id, SalesObservation.product_id == p.id)
            .order_by(SalesObservation.observation_date.desc())
            .first()
        )
        stock_units = last_obs.closing_stock if last_obs else 45

        # Synthetic shelf-life simulation for retail Kirana view
        shelf_days = p.shelf_life_days
        # Let's say item was received 30 days ago
        remaining_days = max(10, shelf_days - 35)

        if remaining_days > 90:
            badge_color = "GREEN"
            badge_label = "Optimal Freshness"
        elif remaining_days >= 30:
            badge_color = "AMBER"
            badge_label = "Liquidate Soon"
        else:
            badge_color = "RED"
            badge_label = "Critical Expiry Warning"

        inventory_items.append({
            "product_id": p.id,
            "sku_code": p.code,
            "sku_name": p.name,
            "category": p.category,
            "mrp": p.mrp,
            "current_stock": stock_units,
            "unit_weight_kg": p.unit_weight_kg,
            "shelf_life_days": p.shelf_life_days,
            "remaining_days": remaining_days,
            "shelf_life_badge": badge_color,
            "badge_label": badge_label
        })

    return {
        "store_id": store.id,
        "store_code": store.code,
        "store_name": store.name,
        "city": store.city,
        "inventory": inventory_items
    }


@router.post("/sale")
def record_pos_sale(payload: POSSaleItem, db: Session = Depends(get_db)):
    """
    Records a retail POS sale and decrements closing stock.
    """
    obs_date = datetime.datetime.utcnow()
    last_obs = (
        db.query(SalesObservation)
        .filter(SalesObservation.store_id == payload.store_id, SalesObservation.product_id == payload.product_id)
        .order_by(SalesObservation.observation_date.desc())
        .first()
    )
    current_closing = last_obs.closing_stock if last_obs else 50
    new_closing = max(0, current_closing - payload.units_sold)

    sale_record = SalesObservation(
        store_id=payload.store_id,
        product_id=payload.product_id,
        observation_date=obs_date,
        units_sold=payload.units_sold,
        closing_stock=new_closing,
        is_promo=False
    )
    db.add(sale_record)
    db.commit()

    return {
        "status": "SUCCESS",
        "units_sold": payload.units_sold,
        "remaining_closing_stock": new_closing,
        "recorded_at": obs_date.isoformat()
    }


@router.post("/sync", response_model=POSSyncBatchResponse)
def sync_offline_sales(payload: POSSyncBatchRequest, db: Session = Depends(get_db)):
    """
    Module 10: Batch synchronization of offline-first sales logged in IndexedDB / localStorage.
    """
    total_synced = 0
    now = datetime.datetime.utcnow()

    for item in payload.sales:
        last_obs = (
            db.query(SalesObservation)
            .filter(SalesObservation.store_id == payload.store_id, SalesObservation.product_id == item.product_id)
            .order_by(SalesObservation.observation_date.desc())
            .first()
        )
        current_closing = last_obs.closing_stock if last_obs else 50
        new_closing = max(0, current_closing - item.units_sold)

        rec = SalesObservation(
            store_id=payload.store_id,
            product_id=item.product_id,
            observation_date=now,
            units_sold=item.units_sold,
            closing_stock=new_closing,
            is_promo=False
        )
        db.add(rec)
        total_synced += 1

    db.commit()

    return {
        "synced_records": total_synced,
        "updated_closing_stock": new_closing if total_synced > 0 else 0,
        "message": f"Successfully synchronized {total_synced} offline sales transactions."
    }
