import io
import csv
import datetime
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models.entities import Warehouse, Store, Product


class MasterDataValidatorService:
    """
    Module 10: Master Data Import Studio Pre-Flight Validator
    Validates CSV uploads against physical constraints and schema rules:
    - Missing required headers
    - Duplicate primary keys
    - Negative quantities, prices, or capacities
    - Date format integrity (ISO 8601 / YYYY-MM-DD)
    - Foreign key referential integrity
    """
    REQUIRED_SCHEMAS = {
        "warehouses": ["code", "name", "city", "state", "latitude", "longitude", "capacity_cases"],
        "stores": ["code", "name", "store_type", "city", "state", "latitude", "longitude", "backroom_capacity_cases"],
        "products": ["code", "name", "category", "unit_weight_kg", "unit_volume_l", "shelf_life_days", "mrp"],
        "inventory_batches": ["warehouse_code", "product_code", "lot_number", "quantity", "expiry_date"],
        "vehicles": ["agent_code", "name", "vehicle_type", "capacity_kg", "capacity_l"],
        "sales_history": ["store_code", "product_code", "observation_date", "units_sold"]
    }

    def validate_csv(self, file_content: str, dataset_type: str, db: Session) -> Dict[str, Any]:
        dataset_type = dataset_type.lower().strip()
        expected_headers = self.REQUIRED_SCHEMAS.get(dataset_type)

        if not expected_headers:
            return {
                "is_valid": False,
                "dataset_type": dataset_type,
                "total_rows": 0,
                "valid_rows": 0,
                "errors": [f"Unknown dataset type '{dataset_type}'. Supported: {list(self.REQUIRED_SCHEMAS.keys())}"],
                "warnings": [],
                "sample_preview": []
            }

        errors = []
        warnings = []
        rows = []
        valid_rows_count = 0

        try:
            reader = csv.DictReader(io.StringIO(file_content))
            headers = [h.strip() for h in (reader.fieldnames or [])]

            # 1. Missing Headers Check
            missing = [h for h in expected_headers if h not in headers]
            if missing:
                errors.append(f"Missing required columns in CSV: {missing}")
                return {
                    "is_valid": False,
                    "dataset_type": dataset_type,
                    "total_rows": 0,
                    "valid_rows": 0,
                    "errors": errors,
                    "warnings": warnings,
                    "sample_preview": []
                }

            # Pre-load known keys for FK checks
            wh_codes = {w.code for w in db.query(Warehouse.code).all()}
            store_codes = {s.code for s in db.query(Store.code).all()}
            product_codes = {p.code for p in db.query(Product.code).all()}

            seen_pks = set()
            valid_rows_count = 0

            for idx, row in enumerate(reader, start=1):
                rows.append(row)
                row_errors = []

                # Duplicate PK check
                pk_val = row.get("code") or row.get("agent_code") or row.get("lot_number")
                if pk_val:
                    if pk_val in seen_pks:
                        row_errors.append(f"Row {idx}: Duplicate primary key '{pk_val}'")
                    seen_pks.add(pk_val)

                # Negative number check
                for num_col in ["capacity_cases", "backroom_capacity_cases", "unit_weight_kg", "unit_volume_l", "shelf_life_days", "mrp", "quantity", "capacity_kg", "capacity_l", "units_sold"]:
                    if num_col in row and row[num_col]:
                        try:
                            val = float(row[num_col])
                            if val < 0:
                                row_errors.append(f"Row {idx}: Negative value '{val}' in column '{num_col}'")
                        except ValueError:
                            row_errors.append(f"Row {idx}: Invalid non-numeric value '{row[num_col]}' in '{num_col}'")

                # Date formatting check
                for date_col in ["expiry_date", "observation_date"]:
                    if date_col in row and row[date_col]:
                        val = row[date_col].strip()
                        try:
                            datetime.date.fromisoformat(val[:10])
                        except ValueError:
                            row_errors.append(f"Row {idx}: Invalid date format '{val}' in '{date_col}' (must be YYYY-MM-DD)")

                # Foreign Key Integrity checks
                if "warehouse_code" in row and row["warehouse_code"]:
                    if row["warehouse_code"].strip() not in wh_codes:
                        warnings.append(f"Row {idx}: Warehouse code '{row['warehouse_code']}' does not match existing registered depots")

                if "product_code" in row and row["product_code"]:
                    if row["product_code"].strip() not in product_codes:
                        warnings.append(f"Row {idx}: SKU code '{row['product_code']}' does not match existing product master")

                if "store_code" in row and row["store_code"]:
                    if row["store_code"].strip() not in store_codes:
                        warnings.append(f"Row {idx}: Store code '{row['store_code']}' does not match existing retail stores")

                if row_errors:
                    errors.extend(row_errors)
                else:
                    valid_rows_count += 1

        except Exception as e:
            errors.append(f"CSV Parse Exception: {str(e)}")

        is_valid = len(errors) == 0
        return {
            "is_valid": is_valid,
            "dataset_type": dataset_type,
            "total_rows": len(rows),
            "valid_rows": valid_rows_count,
            "errors": errors[:50],  # Limit to 50 errors for UX
            "warnings": warnings[:50],
            "sample_preview": rows[:5]
        }
