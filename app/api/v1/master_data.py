from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services.master_data_service import MasterDataValidatorService
from app.schemas.master_data import PreflightValidationResult

router = APIRouter(prefix="/master-data", tags=["Master Data Import Studio"])
validator = MasterDataValidatorService()

CSV_TEMPLATES = {
    "warehouses": "code,name,city,state,latitude,longitude,capacity_cases\nWH-BHIWANDI,Bhiwandi Central Depot,Bhiwandi,Maharashtra,19.2967,73.0631,80000\nWH-CHAKAN,Chakan Regional Hub,Pune,Maharashtra,18.7606,73.8636,50000",
    "stores": "code,name,store_type,city,state,latitude,longitude,backroom_capacity_cases\nSTORE-MUM-01,Dadar Super Kirana,KIRANA,Mumbai,Maharashtra,19.0178,72.8478,2000\nSTORE-PUN-01,Kothrud Provisions,KIRANA,Pune,Maharashtra,18.5074,73.8077,1800",
    "products": "code,name,category,unit_weight_kg,unit_volume_l,shelf_life_days,mrp\nSKU-OIL-01,Fortune Sunflower Oil 1L,Edible Oils,0.91,1.0,270,145.0\nSKU-ATTA-01,Aashirvaad Sharbati Atta 5kg,Staples,5.0,6.5,90,295.0",
    "inventory_batches": "warehouse_code,product_code,lot_number,quantity,expiry_date\nWH-BHIWANDI,SKU-OIL-01,LOT-2026-OIL-B8,1800,2026-12-30\nWH-CHAKAN,SKU-ATTA-01,LOT-2026-ATTA-B2,1200,2026-11-25",
    "vehicles": "agent_code,name,vehicle_type,capacity_kg,capacity_l\nFLEET-MH-01,Sanjay Kadam,Tata Ace (1.5T),1500,3500\nFLEET-MH-02,Ganesh Shinde,Ashok Leyland Dost,2500,5500",
    "sales_history": "store_code,product_code,observation_date,units_sold\nSTORE-MUM-01,SKU-OIL-01,2026-11-01,45\nSTORE-MUM-01,SKU-OIL-01,2026-11-02,40"
}


class CSVValidationPayload(BaseModel):
    dataset_type: str
    csv_content: str


@router.post("/validate", response_model=PreflightValidationResult)
def validate_master_data_csv(
    payload: CSVValidationPayload,
    db: Session = Depends(get_db)
):
    """
    Module 10: Drag-and-drop CSV validator with pre-flight constraint checks:
    missing headers, duplicate PKs, negative values, date formatting, and FK integrity.
    """
    res = validator.validate_csv(
        file_content=payload.csv_content,
        dataset_type=payload.dataset_type,
        db=db
    )
    return res


@router.get("/templates/{dataset_type}")
def get_csv_template(dataset_type: str):
    key = dataset_type.lower().strip()
    if key not in CSV_TEMPLATES:
        raise HTTPException(status_code=404, detail=f"Template for '{dataset_type}' not found")
    return {
        "dataset_type": key,
        "csv_content": CSV_TEMPLATES[key]
    }
