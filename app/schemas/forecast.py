from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class ForecastRunRequest(BaseModel):
    store_id: Optional[int] = None
    product_id: Optional[int] = None
    quantiles: List[float] = [0.10, 0.50, 0.80, 0.90, 0.95]


class ForecastRunResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    baseline_wape: float
    model_wape: float
    relative_improvement: float
    relative_improvement_pct: str
    gate_passed: bool
    decision: str
    anomaly_summary: Dict[str, Any]
    predictions_sample: List[Dict[str, Any]]
