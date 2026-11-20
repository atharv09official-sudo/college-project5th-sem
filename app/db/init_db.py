import datetime
from sqlalchemy.orm import Session
from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.core.security import get_password_hash
from app.core.enums import UserRole, StoreType
from app.models.entities import (
    User,
    Warehouse,
    Store,
    Product,
    InventoryBatch,
    RouteEstimate,
    DeliveryAgent,
    SalesObservation,
)
from app.models.trade_route_entities import (
    ShipmentPlanRequest,
    TradeRouteResult,
)


def init_db(db: Session = None, force_reset: bool = False):
    if force_reset:
        Base.metadata.drop_all(bind=engine)

    # Create all tables
    Base.metadata.create_all(bind=engine)

    close_session = False
    if db is None:
        db = SessionLocal()
        close_session = True

    try:
        # Check if already seeded
        if not force_reset and db.query(User).first() is not None:
            return

        # 1. Seed Users (with separation of duties roles)
        admin_user = User(
            name="Rajesh Sharma (Admin)",
            email="admin@flowgrid.ai",
            hashed_password=get_password_hash("Admin@123"),
            role=UserRole.ADMIN,
            is_active=True,
        )
        planner_user = User(
            name="Pooja Deshmukh (Supply Planner)",
            email="planner@flowgrid.ai",
            hashed_password=get_password_hash("Planner@123"),
            role=UserRole.PLANNER,
            is_active=True,
        )
        approver_user = User(
            name="Vikram Joshi (Distribution Approver)",
            email="approver@flowgrid.ai",
            hashed_password=get_password_hash("Approver@123"),
            role=UserRole.APPROVER,
            is_active=True,
        )
        operator_user = User(
            name="Suresh Patil (Depot Operator)",
            email="operator@flowgrid.ai",
            hashed_password=get_password_hash("Operator@123"),
            role=UserRole.OPERATOR,
            is_active=True,
        )
        viewer_user = User(
            name="Ananya Roy (Audit Viewer)",
            email="viewer@flowgrid.ai",
            hashed_password=get_password_hash("Viewer@123"),
            role=UserRole.VIEWER,
            is_active=True,
        )

        db.add_all([admin_user, planner_user, approver_user, operator_user, viewer_user])
        db.flush()

        # 2. Seed Warehouses (Maharashtra Logistics Hubs)
        wh_bhiwandi = Warehouse(
            code="WH-BHIWANDI",
            name="Bhiwandi Central Mega Depot",
            city="Bhiwandi",
            state="Maharashtra",
            latitude=19.2967,
            longitude=73.0631,
            capacity_cases=80000,
        )
        wh_chakan = Warehouse(
            code="WH-CHAKAN",
            name="Chakan Pune Regional Hub",
            city="Pune",
            state="Maharashtra",
            latitude=18.7606,
            longitude=73.8636,
            capacity_cases=50000,
        )
        wh_nagpur = Warehouse(
            code="WH-NAGPUR",
            name="Nagpur Multi-Modal Logistics Hub",
            city="Nagpur",
            state="Maharashtra",
            latitude=21.1458,
            longitude=79.0882,
            capacity_cases=60000,
        )
        db.add_all([wh_bhiwandi, wh_chakan, wh_nagpur])
        db.flush()

        # 3. Seed Retail Stores (Mumbai, Pune, Nashik, Kolhapur)
        stores = [
            Store(
                code="STORE-MUM-01",
                name="Dadar Super Kirana",
                store_type=StoreType.KIRANA,
                city="Mumbai",
                state="Maharashtra",
                latitude=19.0178,
                longitude=72.8478,
                backroom_capacity_cases=2000,
                current_cases=350,
                min_shelf_life_pct=0.70,
                daily_turnover_tier="P0",  # High velocity
            ),
            Store(
                code="STORE-MUM-02",
                name="Andheri West Daily Mart",
                store_type=StoreType.SUPERMARKET,
                city="Mumbai",
                state="Maharashtra",
                latitude=19.1363,
                longitude=72.8277,
                backroom_capacity_cases=4000,
                current_cases=1200,
                min_shelf_life_pct=0.70,
                daily_turnover_tier="P0",  # High velocity
            ),
            Store(
                code="STORE-PUN-01",
                name="Kothrud Express Provisions",
                store_type=StoreType.KIRANA,
                city="Pune",
                state="Maharashtra",
                latitude=18.5074,
                longitude=73.8077,
                backroom_capacity_cases=1800,
                current_cases=420,
                min_shelf_life_pct=0.70,
                daily_turnover_tier="P1",  # Medium velocity
            ),
            Store(
                code="STORE-PUN-02",
                name="Hinjawadi Phase-1 Mega Bazaar",
                store_type=StoreType.HYPERMARKET,
                city="Pune",
                state="Maharashtra",
                latitude=18.5913,
                longitude=73.7389,
                backroom_capacity_cases=6000,
                current_cases=1900,
                min_shelf_life_pct=0.65,
                daily_turnover_tier="P0",  # High velocity
            ),
            Store(
                code="STORE-NAS-01",
                name="Nashik Road FMCG Depot",
                store_type=StoreType.KIRANA,
                city="Nashik",
                state="Maharashtra",
                latitude=19.9975,
                longitude=73.7898,
                backroom_capacity_cases=2500,
                current_cases=800,
                min_shelf_life_pct=0.70,
                daily_turnover_tier="P2",  # Slow velocity
            ),
            Store(
                code="STORE-KOL-01",
                name="Kolhapur Rajwada Grocers",
                store_type=StoreType.KIRANA,
                city="Kolhapur",
                state="Maharashtra",
                latitude=16.7050,
                longitude=74.2433,
                backroom_capacity_cases=2200,
                current_cases=600,
                min_shelf_life_pct=0.70,
                daily_turnover_tier="P2",  # Slow velocity
            ),
        ]
        db.add_all(stores)
        db.flush()

        # 4. Seed Products / SKUs
        products = [
            Product(
                code="SKU-OIL-01",
                name="Fortune Sunflower Oil 1L Pouch",
                category="Edible Oils",
                unit_weight_kg=0.91,
                unit_volume_l=1.0,
                shelf_life_days=270,
                mrp=145.0,
                case_pack=12,
            ),
            Product(
                code="SKU-ATTA-01",
                name="Aashirvaad Superior Sharbati Atta 5kg",
                category="Staples",
                unit_weight_kg=5.0,
                unit_volume_l=6.5,
                shelf_life_days=90,
                mrp=295.0,
                case_pack=4,
            ),
            Product(
                code="SKU-NOOD-01",
                name="Maggi 2-Minute Masala Noodles 280g (Pack of 4)",
                category="Packaged Foods",
                unit_weight_kg=0.28,
                unit_volume_l=0.8,
                shelf_life_days=240,
                mrp=56.0,
                case_pack=24,
            ),
            Product(
                code="SKU-MILK-01",
                name="Amul Taaza Homogenised Toned Milk 1L",
                category="Dairy & Beverages",
                unit_weight_kg=1.03,
                unit_volume_l=1.0,
                shelf_life_days=180,
                mrp=72.0,
                case_pack=12,
            ),
            Product(
                code="SKU-BIS-01",
                name="Parle-G Gold Biscuits 1kg Family Pack",
                category="Bakery & Snacks",
                unit_weight_kg=1.0,
                unit_volume_l=1.5,
                shelf_life_days=180,
                mrp=95.0,
                case_pack=10,
            ),
            Product(
                code="SKU-TEA-01",
                name="Tata Tea Gold Leaf Tea 500g",
                category="Beverages",
                unit_weight_kg=0.5,
                unit_volume_l=0.9,
                shelf_life_days=365,
                mrp=310.0,
                case_pack=20,
            ),
        ]
        db.add_all(products)
        db.flush()

        # 5. Seed Inventory Batches (FEFO Tracking with near-expiry and fresh lots)
        now = datetime.datetime.utcnow()
        batches = [
            # Oil in Bhiwandi: Batch 1 (Near-expiry: 42 days remaining -> Route to P0 stores!)
            InventoryBatch(
                warehouse_id=wh_bhiwandi.id,
                product_id=products[0].id,
                lot_number="LOT-2026-OIL-B8",
                quantity=1800,
                reserved_quantity=0,
                manufacturing_date=now - datetime.timedelta(days=228),
                expiry_date=now + datetime.timedelta(days=42),
            ),
            # Oil in Bhiwandi: Batch 2 (Fresh: 210 days remaining)
            InventoryBatch(
                warehouse_id=wh_bhiwandi.id,
                product_id=products[0].id,
                lot_number="LOT-2026-OIL-C1",
                quantity=4500,
                reserved_quantity=0,
                manufacturing_date=now - datetime.timedelta(days=60),
                expiry_date=now + datetime.timedelta(days=210),
            ),
            # Atta in Bhiwandi: Batch 1 (35 days remaining -> 5kg atta short shelf life)
            InventoryBatch(
                warehouse_id=wh_bhiwandi.id,
                product_id=products[1].id,
                lot_number="LOT-2026-ATTA-A3",
                quantity=800,
                reserved_quantity=0,
                manufacturing_date=now - datetime.timedelta(days=55),
                expiry_date=now + datetime.timedelta(days=35),
            ),
            # Atta in Chakan: Batch 2 (70 days remaining)
            InventoryBatch(
                warehouse_id=wh_chakan.id,
                product_id=products[1].id,
                lot_number="LOT-2026-ATTA-B2",
                quantity=1200,
                reserved_quantity=0,
                manufacturing_date=now - datetime.timedelta(days=20),
                expiry_date=now + datetime.timedelta(days=70),
            ),
            # Noodles in Chakan: (160 days remaining)
            InventoryBatch(
                warehouse_id=wh_chakan.id,
                product_id=products[2].id,
                lot_number="LOT-2026-MAG-E4",
                quantity=3200,
                reserved_quantity=0,
                manufacturing_date=now - datetime.timedelta(days=80),
                expiry_date=now + datetime.timedelta(days=160),
            ),
            # Milk in Bhiwandi: (95 days remaining)
            InventoryBatch(
                warehouse_id=wh_bhiwandi.id,
                product_id=products[3].id,
                lot_number="LOT-2026-MLK-D2",
                quantity=2400,
                reserved_quantity=0,
                manufacturing_date=now - datetime.timedelta(days=85),
                expiry_date=now + datetime.timedelta(days=95),
            ),
            # Biscuits in Chakan: (110 days remaining)
            InventoryBatch(
                warehouse_id=wh_chakan.id,
                product_id=products[4].id,
                lot_number="LOT-2026-PG-K9",
                quantity=2000,
                reserved_quantity=0,
                manufacturing_date=now - datetime.timedelta(days=70),
                expiry_date=now + datetime.timedelta(days=110),
            ),
            # Tea in Nagpur: (280 days remaining)
            InventoryBatch(
                warehouse_id=wh_nagpur.id,
                product_id=products[5].id,
                lot_number="LOT-2026-TEA-T1",
                quantity=1500,
                reserved_quantity=0,
                manufacturing_date=now - datetime.timedelta(days=85),
                expiry_date=now + datetime.timedelta(days=280),
            ),
            # Tea in Bhiwandi: (310 days remaining)
            InventoryBatch(
                warehouse_id=wh_bhiwandi.id,
                product_id=products[5].id,
                lot_number="LOT-2026-TEA-T2",
                quantity=1800,
                reserved_quantity=0,
                manufacturing_date=now - datetime.timedelta(days=55),
                expiry_date=now + datetime.timedelta(days=310),
            ),
        ]
        db.add_all(batches)
        db.flush()

        # 6. Seed Route Estimates (Maharashtra Corridors & Western Ghats)
        routes = [
            RouteEstimate(
                origin_warehouse_id=wh_bhiwandi.id,
                destination_store_id=stores[0].id,  # Bhiwandi to Dadar
                corridor_code="CORR-BHW-MUM-01",
                distance_km=42.0,
                base_cost=850.0,
                is_ghat_route=False,
                normal_transit_hours=1.8,
            ),
            RouteEstimate(
                origin_warehouse_id=wh_bhiwandi.id,
                destination_store_id=stores[1].id,  # Bhiwandi to Andheri
                corridor_code="CORR-BHW-MUM-02",
                distance_km=38.0,
                base_cost=780.0,
                is_ghat_route=False,
                normal_transit_hours=1.5,
            ),
            RouteEstimate(
                origin_warehouse_id=wh_bhiwandi.id,
                destination_store_id=stores[2].id,  # Bhiwandi to Pune Kothrud (Via Khandala Ghat)
                corridor_code="CORR-BHW-PUN-GHAT",
                distance_km=158.0,
                base_cost=3400.0,
                is_ghat_route=True,
                normal_transit_hours=4.2,
            ),
            RouteEstimate(
                origin_warehouse_id=wh_chakan.id,
                destination_store_id=stores[2].id,  # Chakan to Pune Kothrud
                corridor_code="CORR-CHK-PUN-01",
                distance_km=36.0,
                base_cost=650.0,
                is_ghat_route=False,
                normal_transit_hours=1.2,
            ),
            RouteEstimate(
                origin_warehouse_id=wh_chakan.id,
                destination_store_id=stores[3].id,  # Chakan to Pune Hinjawadi
                corridor_code="CORR-CHK-PUN-02",
                distance_km=28.0,
                base_cost=520.0,
                is_ghat_route=False,
                normal_transit_hours=0.9,
            ),
            RouteEstimate(
                origin_warehouse_id=wh_bhiwandi.id,
                destination_store_id=stores[4].id,  # Bhiwandi to Nashik (Via Kasara Ghat)
                corridor_code="CORR-BHW-NAS-GHAT",
                distance_km=135.0,
                base_cost=2900.0,
                is_ghat_route=True,
                normal_transit_hours=3.8,
            ),
            RouteEstimate(
                origin_warehouse_id=wh_chakan.id,
                destination_store_id=stores[5].id,  # Chakan to Kolhapur
                corridor_code="CORR-CHK-KOL-01",
                distance_km=245.0,
                base_cost=4600.0,
                is_ghat_route=False,
                normal_transit_hours=5.5,
            ),
        ]
        db.add_all(routes)
        db.flush()

        # 7. Seed Delivery Agents / Fleet
        agents = [
            DeliveryAgent(
                agent_code="FLEET-MH-01",
                name="Sanjay Kadam",
                vehicle_type="Tata Ace (1.5T)",
                capacity_kg=1500.0,
                capacity_l=3500.0,
                availability_status="AVAILABLE",
                lat=19.2967,
                lng=73.0631,
                last_heartbeat=now,
            ),
            DeliveryAgent(
                agent_code="FLEET-MH-02",
                name="Ganesh Shinde",
                vehicle_type="Ashok Leyland Dost (2.5T)",
                capacity_kg=2500.0,
                capacity_l=5500.0,
                availability_status="AVAILABLE",
                lat=18.7606,
                lng=73.8636,
                last_heartbeat=now,
            ),
            DeliveryAgent(
                agent_code="FLEET-MH-03",
                name="Mahesh Pawar",
                vehicle_type="Eicher Pro 3015 (10T)",
                capacity_kg=10000.0,
                capacity_l=22000.0,
                availability_status="AVAILABLE",
                lat=19.2967,
                lng=73.0631,
                last_heartbeat=now,
            ),
        ]
        db.add_all(agents)
        db.flush()

        # 8. Seed Sales History for Time Series & Zero-Leakage Chronological Splits
        # 90 days of daily sales observations
        sales_data = []
        for days_ago in range(90, 0, -1):
            obs_date = now - datetime.timedelta(days=days_ago)
            day_of_week = obs_date.weekday()
            is_weekend = day_of_week in [5, 6]

            for s in stores:
                base_demand = 40 if s.daily_turnover_tier == "P0" else 20 if s.daily_turnover_tier == "P1" else 10
                for p in products:
                    # Weekly seasonality + weekend lift
                    weekend_multiplier = 1.35 if is_weekend else 1.0
                    units = int(base_demand * weekend_multiplier)
                    # Simulated closing stock
                    closing = max(10, 200 - units * 2)

                    sales_data.append(
                        SalesObservation(
                            store_id=s.id,
                            product_id=p.id,
                            observation_date=obs_date,
                            units_sold=units,
                            closing_stock=closing,
                            is_promo=False,
                        )
                    )

        db.add_all(sales_data)
        db.commit()
        print("Database initialized and seeded successfully with Maharashtra FMCG master data.")

    except Exception as e:
        db.rollback()
        print(f"Error during init_db: {e}")
        raise
    finally:
        if close_session:
            db.close()


if __name__ == "__main__":
    init_db()
