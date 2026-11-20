from typing import List, Optional
from pydantic import BaseModel


class POSSaleItem(BaseModel):
    store_id: int
    product_id: int
    units_sold: int
    sale_timestamp: Optional[str] = None
    offline_client_id: Optional[str] = None


class POSSyncBatchRequest(BaseModel):
    store_id: int
    sales: List[POSSaleItem]


class POSSyncBatchResponse(BaseModel):
    synced_records: int
    updated_closing_stock: int
    message: str
