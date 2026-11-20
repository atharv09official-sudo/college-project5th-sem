import json
import time
import requests
from typing import Dict, Any, Optional


class OllamaIntelligenceEngine:
    """
    Explainable AI & Local LLM Integration (Ollama)
    Implements Invariant 5: Strict timeout with deterministic rule-based fallback.
    Caches availability to avoid repetitive socket connect timeouts when Ollama is offline.
    """
    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model: str = "llama3.2:latest",
        timeout_seconds: int = 35
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout_seconds = timeout_seconds
        self._last_availability_check: float = 0.0
        self._is_ollama_available: bool = False

    def _check_ollama_available(self) -> bool:
        """Check if Ollama server is responding within 0.25 seconds, cached for 60 seconds."""
        now = time.time()
        if now - self._last_availability_check < 60.0:
            return self._is_ollama_available

        self._last_availability_check = now
        try:
            resp = requests.get(f"{self.base_url}/api/tags", timeout=0.25)
            self._is_ollama_available = (resp.status_code == 200)
        except Exception:
            self._is_ollama_available = False
        return self._is_ollama_available

    def generate_explanation(self, allocation_info: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generates natural language explanation for proposed shipment.
        Falls back to verified deterministic rule-based template engine.
        """
        store_code = allocation_info.get("dest_store_code", "Store")
        store_name = allocation_info.get("dest_store_name", store_code)
        sku_name = allocation_info.get("sku_name", "Product")
        qty = allocation_info.get("quantity", 0)
        lot = allocation_info.get("lot_number", "LOT")
        wh_code = allocation_info.get("source_wh_code", "Warehouse")
        exp_days = allocation_info.get("shelf_life_remaining_days", 60)
        arrival_pct = allocation_info.get("arrival_shelf_life_pct", 75.0)
        transport_cost = allocation_info.get("transport_cost", 0.0)
        category = allocation_info.get("reason_category", "STOCKOUT_PREVENTION")
        dos = allocation_info.get("days_of_supply", 1.8)

        # Attempt Ollama only if server is known to be available
        if self._check_ollama_available():
            prompt = (
                f"You are FlowGrid FMCG Supply Chain AI. Write a concise 2-sentence rationale for this dispatch:\n"
                f"- Store: {store_name} ({store_code}) with {dos} Days of Supply\n"
                f"- SKU: {sku_name}, Quantity: {qty} units\n"
                f"- Source Depot: {wh_code}, Lot: {lot} expiring in {exp_days} days\n"
                f"- Category: {category}, Arrival Shelf-Life: {arrival_pct}%, Freight: ₹{transport_cost}\n"
                f"Explain clearly why this store and batch were selected."
            )

            try:
                resp = requests.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {"temperature": 0.2, "num_predict": 100}
                    },
                    timeout=2.0
                )
                if resp.status_code == 200:
                    result = resp.json()
                    llm_response = result.get("response", "").strip()
                    if llm_response:
                        return {
                            "category": category,
                            "rationale": llm_response,
                            "engine": "OLLAMA_LLM",
                            "model": self.model,
                            "fallback_used": False
                        }
            except Exception:
                self._is_ollama_available = False

        # Invariant 5: Verified Deterministic Template Fallback
        fallback_rationale = self._deterministic_template(
            category=category,
            store_name=store_name,
            store_code=store_code,
            sku_name=sku_name,
            qty=qty,
            lot=lot,
            wh_code=wh_code,
            exp_days=exp_days,
            arrival_pct=arrival_pct,
            transport_cost=transport_cost,
            dos=dos
        )

        return {
            "category": category,
            "rationale": fallback_rationale,
            "engine": "DETERMINISTIC_RULE_TEMPLATE",
            "model": "rule_engine_v2",
            "fallback_used": True
        }

    def parse_driver_disruption(self, raw_text: str) -> Dict[str, Any]:
        """
        Converts unstructured driver reports (e.g. WhatsApp/SMS voice-to-text) into structured disruption events.
        """
        text_lower = raw_text.lower()
        delay_min = 60
        corridor = "NH-48"
        severity = "MEDIUM"

        if "khandala" in text_lower or "lonavala" in text_lower:
            corridor = "Khandala Ghat (NH-48)"
        elif "kasara" in text_lower or "igatpuri" in text_lower:
            corridor = "Kasara Ghat (NH-160)"
        elif "bhor" in text_lower:
            corridor = "Bhor Ghat"
        elif "mumbai" in text_lower or "pune" in text_lower:
            corridor = "Mumbai-Pune Expressway"

        if "breakdown" in text_lower or "axle" in text_lower or "puncture" in text_lower or "accident" in text_lower:
            delay_min = 120
            severity = "HIGH"
            cause = "VEHICLE_BREAKDOWN"
        elif "landslide" in text_lower or "flood" in text_lower or "heavy rain" in text_lower:
            delay_min = 90
            severity = "HIGH"
            cause = "WEATHER_WATERLOGGING"
        elif "jam" in text_lower or "traffic" in text_lower:
            delay_min = 45
            severity = "MEDIUM"
            cause = "TRAFFIC_CONGESTION"
        else:
            delay_min = 30
            severity = "LOW"
            cause = "TRANSIT_DELAY"

        return {
            "raw_text": raw_text,
            "detected_corridor": corridor,
            "cause_code": cause,
            "estimated_delay_minutes": delay_min,
            "severity": severity,
            "requires_driver_reassignment": "breakdown" in text_lower
        }

    def _deterministic_template(
        self,
        category: str,
        store_name: str,
        store_code: str,
        sku_name: str,
        qty: int,
        lot: str,
        wh_code: str,
        exp_days: int,
        arrival_pct: float,
        transport_cost: float,
        dos: float
    ) -> str:
        if category == "EXPIRY_URGENT":
            return (
                f"Store {store_name} ({store_code}) is a high-turnover tier endpoint capable of liquidating stock rapidly. "
                f"Warehouse {wh_code} holds Batch {lot} expiring in {exp_days} days. "
                f"Dispatched {qty} units meeting {arrival_pct}% arrival shelf-life criteria to eliminate expiry loss."
            )
        elif category == "STOCKOUT_PREVENTION":
            return (
                f"Store {store_code} has critically low {dos:.1f} Days of Supply remaining for {sku_name}. "
                f"Immediate replenishment of {qty} units dispatched from {wh_code} via optimal regional corridor "
                f"(₹{transport_cost:.2f} freight) to prevent impending shelf stockout."
            )
        elif category == "PROMOTION_SURGE":
            return (
                f"Store {store_name} experiencing promotional demand surge. Dispatched {qty} units from {wh_code} "
                f"using Batch {lot} ({arrival_pct}% shelf life remaining) to fulfill elevated customer footfall."
            )
        else:  # DISTANCE_OPTIMAL
            return (
                f"Dispatched {qty} units of {sku_name} from regional hub {wh_code} to {store_code}. "
                f"Optimized for least-cost freight (₹{transport_cost:.2f}) and {arrival_pct}% retail freshness at destination."
            )
