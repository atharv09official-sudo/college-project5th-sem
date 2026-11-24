from typing import Dict, Any
from fastapi import APIRouter
from pydantic import BaseModel
from models.road_risk_predictor import MaharashtraRoadRiskPredictor
from models.ollama_intelligence import OllamaIntelligenceEngine
from app.schemas.road_risk import RoadRiskRequest, RoadRiskResponse

router = APIRouter(prefix="/ai", tags=["Predictive & Generative AI"])
road_risk_engine = MaharashtraRoadRiskPredictor()
ai_engine = OllamaIntelligenceEngine()


class ExplainPlanRequest(BaseModel):
    dest_store_code: str = "STORE-MUM-01"
    dest_store_name: str = "Dadar Super Kirana"
    sku_name: str = "Fortune Sunflower Oil 1L Pouch"
    quantity: int = 120
    lot_number: str = "LOT-2026-OIL-B8"
    source_wh_code: str = "WH-BHIWANDI"
    shelf_life_remaining_days: int = 42
    arrival_shelf_life_pct: float = 78.5
    transport_cost: float = 450.0
    reason_category: str = "EXPIRY_URGENT"
    days_of_supply: float = 1.4


class DisruptionParseRequest(BaseModel):
    raw_text: str = "Driver reporting huge landslide and waterlogging on Khandala Ghat NH48, traffic halted, will delay at least 2 hours."


class CorridorIntelligenceRequest(BaseModel):
    from_country: str = "India"
    to_country: str = "Netherlands"
    external_news: str = ""


@router.post("/road-risk", response_model=RoadRiskResponse)
def predict_road_risk(payload: RoadRiskRequest):
    """
    Module 7: Dynamic transit delay prediction and hazard classification
    for Western Ghat corridors (Khandala, Kasara, Bhor).
    """
    res = road_risk_engine.predict(
        rainfall_mm=payload.rainfall_mm,
        visibility_km=payload.visibility_km,
        pothole_or_surface_risk_index=payload.pothole_or_surface_risk_index,
        waterlogging_flag=payload.waterlogging_flag,
        traffic_congestion_index=payload.traffic_congestion_index,
        is_ghat_route=payload.is_ghat_route,
        base_freight=payload.base_freight,
        current_diesel_price=payload.current_diesel_price
    )
    return res


@router.post("/explain-plan")
def explain_plan_dispatch(payload: ExplainPlanRequest):
    """
    Module 9: Generate natural language explanation (Ollama LLM with deterministic template fallback).
    """
    return ai_engine.generate_explanation(payload.dict())


@router.post("/parse-disruption")
def parse_driver_disruption(payload: DisruptionParseRequest):
    """
    Module 9: Converts unstructured driver voice/SMS messages into structured disruption records.
    """
    return ai_engine.parse_driver_disruption(payload.raw_text)


@router.post("/corridor-intelligence")
def generate_corridor_intelligence(payload: CorridorIntelligenceRequest):
    """
    Generates fast multi-tier reasoning for trade corridors weighted by routing_data.json.
    """
    return ai_engine.generate_corridor_llm_intelligence(
        from_country=payload.from_country,
        to_country=payload.to_country,
        external_news=payload.external_news
    )


@router.get("/status")
def get_ai_status():
    """
    Retrieves status of free cloud/Ollama AI engine, cache metrics, and latency diagnostics.
    """
    return ai_engine.get_engine_status()
