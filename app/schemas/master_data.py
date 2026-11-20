from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class PreflightValidationResult(BaseModel):
    is_valid: bool
    dataset_type: str
    total_rows: int
    valid_rows: int
    errors: List[str]
    warnings: List[str]
    sample_preview: List[Dict[str, Any]]
