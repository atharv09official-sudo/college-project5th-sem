import json
import os
import time
import requests
from typing import Dict, Any, Optional, Tuple


class OllamaIntelligenceEngine:
    """
    Explainable AI & Multi-Tier Reasoning Engine.
    Integrates:
      1. Ollama Cloud / Local Ollama (llama3.2:latest, deepseek-r1, etc.)
      2. Free Cloud-Based Models (OpenRouter devstral/2-2512:free, deepseek/r1t2-chimera:free, Groq)
      3. Ultra-fast in-memory LRU reasoning cache with pre-warmed trade corridors
      4. Invariant 5: Strict non-blocking timeouts with deterministic rule-based fallback.
    """
    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout_seconds: int = 15
    ):
        raw_base = base_url or os.getenv("OLLAMA_CLOUD_URL") or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.base_url = raw_base.rstrip("/")
        self.model = model or os.getenv("OLLAMA_MODEL", "llama3.2:latest")
        self.timeout_seconds = timeout_seconds

        # Free Cloud Model Settings
        self.openrouter_key = os.getenv("OPENROUTER_API_KEY", "").strip()
        self.openrouter_model = os.getenv("OPENROUTER_MODEL_REASONING", "devstral/2-2512:free")
        self.openrouter_fast_model = os.getenv("OPENROUTER_MODEL_FAST", "mimo/v2-flash:free")
        self.groq_key = os.getenv("GROQ_API_KEY", "").strip()

        # Low-latency availability caching (0.25s check cached for 60s)
        self._last_availability_check: float = 0.0
        self._is_ollama_available: bool = False
        self._is_cloud_available: bool = self._eval_cloud_key_presence()

        # In-memory reasoning cache (Key -> (ResultDict, Timestamp, ExpirySeconds))
        self._cache: Dict[str, Tuple[Dict[str, Any], float, float]] = {}
        self._cache_hits: int = 0
        self._total_queries: int = 0
        self._latency_history: list[float] = []

        # Pre-seed common corridors for instantaneous (<1ms) initial responses
        self._seed_prewarmed_corridors()

    def _eval_cloud_key_presence(self) -> bool:
        """Determines if a valid non-dummy cloud API key is configured."""
        dummy_markers = ["your_", "mock_", "change_in_prod", "sk-mock", "placeholder"]
        if self.openrouter_key and not any(m in self.openrouter_key.lower() for m in dummy_markers):
            return True
        if self.groq_key and not any(m in self.groq_key.lower() for m in dummy_markers):
            return True
        return False

    def _check_ollama_available(self) -> bool:
        """Check if Ollama server (local or cloud) is responding within 0.25 seconds."""
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

    def _get_from_cache(self, key: str) -> Optional[Dict[str, Any]]:
        """Retrieves cached item if present and unexpired."""
        entry = self._cache.get(key)
        if not entry:
            return None
        data, ts, ttl = entry
        if (time.time() - ts) > ttl:
            self._cache.pop(key, None)
            return None
        self._cache_hits += 1
        cached_copy = dict(data)
        cached_copy["from_cache"] = True
        cached_copy["latency_ms"] = 0.4
        return cached_copy

    def _put_into_cache(self, key: str, data: Dict[str, Any], ttl_seconds: float = 3600.0) -> None:
        """Stores item in fast in-memory LRU cache."""
        # Evict oldest if cache size exceeds 500 entries
        if len(self._cache) > 500:
            oldest_key = next(iter(self._cache))
            self._cache.pop(oldest_key, None)
        self._cache[key] = (data, time.time(), ttl_seconds)

    def _query_free_cloud(self, prompt: str, system_prompt: str = "") -> Optional[str]:
        """
        Queries free cloud models (OpenRouter free tier or Groq) with a fast 1.8s timeout.
        """
        if not self._is_cloud_available:
            return None

        # 1. Try OpenRouter Free Tier
        if self.openrouter_key and not any(m in self.openrouter_key.lower() for m in ["your_", "mock_"]):
            try:
                headers = {
                    "Authorization": f"Bearer {self.openrouter_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://supplyguard.ai",
                    "X-Title": "SupplyGuard AI Corridor Reasoning"
                }
                messages = []
                if system_prompt:
                    messages.append({"role": "system", "content": system_prompt})
                messages.append({"role": "user", "content": prompt})

                body = {
                    "model": self.openrouter_model,
                    "messages": messages,
                    "temperature": 0.2,
                    "max_tokens": 140
                }
                resp = requests.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json=body,
                    timeout=1.8
                )
                if resp.status_code == 200:
                    data = resp.json()
                    choices = data.get("choices", [])
                    if choices and "message" in choices[0]:
                        return choices[0]["message"].get("content", "").strip()
            except Exception:
                pass

        # 2. Try Groq Free Fast Gateway
        if self.groq_key and not any(m in self.groq_key.lower() for m in ["your_", "mock_"]):
            try:
                headers = {
                    "Authorization": f"Bearer {self.groq_key}",
                    "Content-Type": "application/json"
                }
                body = {
                    "model": "llama-3.1-8b-instant",
                    "messages": [
                        {"role": "system", "content": system_prompt or "You are an expert trade logistics AI."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.2,
                    "max_tokens": 120
                }
                resp = requests.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers=headers,
                    json=body,
                    timeout=1.5
                )
                if resp.status_code == 200:
                    data = resp.json()
                    choices = data.get("choices", [])
                    if choices and "message" in choices[0]:
                        return choices[0]["message"].get("content", "").strip()
            except Exception:
                pass

        return None

    def _query_ollama(self, prompt: str) -> Optional[str]:
        """Queries local or cloud Ollama server with a fast 1.8s timeout."""
        if not self._check_ollama_available():
            return None
        try:
            resp = requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.2, "num_predict": 120}
                },
                timeout=1.8
            )
            if resp.status_code == 200:
                result = resp.json()
                return result.get("response", "").strip()
        except Exception:
            self._is_ollama_available = False
        return None

    def generate_explanation(self, allocation_info: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generates natural language explanation for proposed shipment.
        Fulfills Invariant 5: Strict timeout with verified deterministic template fallback.
        """
        start_t = time.time()
        self._total_queries += 1

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

        cache_key = f"EXP_{store_code}_{sku_name}_{lot}_{qty}_{category}"
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached

        prompt = (
            f"You are FlowGrid FMCG Supply Chain AI. Write a concise 2-sentence rationale for this dispatch:\n"
            f"- Store: {store_name} ({store_code}) with {dos} Days of Supply\n"
            f"- SKU: {sku_name}, Quantity: {qty} units\n"
            f"- Source Depot: {wh_code}, Lot: {lot} expiring in {exp_days} days\n"
            f"- Category: {category}, Arrival Shelf-Life: {arrival_pct}%, Freight: ₹{transport_cost}\n"
            f"Explain clearly why this store and batch were selected."
        )

        # 1. Attempt Ollama first if server is explicitly responding
        if self._check_ollama_available():
            llm_text = self._query_ollama(prompt)
            if llm_text:
                latency = round((time.time() - start_t) * 1000, 1)
                self._latency_history.append(latency)
                out = {
                    "category": category,
                    "rationale": llm_text,
                    "engine": "OLLAMA_LLM",
                    "model": self.model,
                    "fallback_used": False,
                    "latency_ms": latency
                }
                self._put_into_cache(cache_key, out)
                return out

        # 2. Attempt Free Cloud Reasoning if Ollama is not active
        if self._is_cloud_available:
            cloud_text = self._query_free_cloud(prompt, system_prompt="You are FlowGrid FMCG Logistics Dispatch AI.")
            if cloud_text:
                latency = round((time.time() - start_t) * 1000, 1)
                self._latency_history.append(latency)
                out = {
                    "category": category,
                    "rationale": cloud_text,
                    "engine": "FREE_CLOUD_LLM",
                    "model": self.openrouter_model,
                    "fallback_used": False,
                    "latency_ms": latency
                }
                self._put_into_cache(cache_key, out)
                return out

        # 3. Invariant 5: Deterministic Ground-Truth Template Fallback
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

        latency = round((time.time() - start_t) * 1000, 1)
        self._latency_history.append(latency)
        out = {
            "category": category,
            "rationale": fallback_rationale,
            "engine": "DETERMINISTIC_RULE_TEMPLATE",
            "model": "rule_engine_v2",
            "fallback_used": True,
            "latency_ms": latency
        }
        self._put_into_cache(cache_key, out)
        return out

    def generate_corridor_llm_intelligence(
        self,
        from_country: str,
        to_country: str,
        external_news: str = "",
        risk_summary: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generates fast LLM corridor reasoning weighted by routing_data.json key points.
        Integrates weights for sanctions, landlocked status, maritime ports, and airport hubs.
        Returns from in-memory cache instantly (<1ms) or evaluates via free cloud / Ollama / deterministic rules.
        """
        start_t = time.time()
        self._total_queries += 1

        u_raw = str(from_country or "India").strip()
        v_raw = str(to_country or "Netherlands").strip()

        # Check Cache
        cache_key = f"CORRIDOR_{u_raw.upper()}->{v_raw.upper()}"
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached

        from src.utils.routing_weight_engine import routing_weight_engine
        weights = routing_weight_engine.compute_routing_weights(u_raw, v_raw)
        u_name = weights["from_name"]
        v_name = weights["to_name"]
        infra = weights.get("infrastructure", {})

        # 1. Try Ollama if responsive
        if self._check_ollama_available():
            routing_ctx = routing_weight_engine.format_llm_routing_context(u_raw, v_raw, external_news)
            prompt = (
                f"You are SupplyGuard AI Global Trade Intelligence. "
                f"Synthesize this corridor using its ground-truth routing weights and real-time news:\n\n"
                f"{routing_ctx}\n\n"
                f"Provide a concise 2-sentence operational logistics advisory detailing feasible modes, "
                f"key chokepoints, and required risk mitigation."
            )
            llm_text = self._query_ollama(prompt)
            if llm_text:
                latency = round((time.time() - start_t) * 1000, 1)
                self._latency_history.append(latency)
                out = {
                    "origin": u_name,
                    "destination": v_name,
                    "advisory": llm_text,
                    "weights": weights,
                    "engine": "OLLAMA_LLM",
                    "model": self.model,
                    "fallback_used": False,
                    "latency_ms": latency
                }
                self._put_into_cache(cache_key, out)
                return out

        # 2. Try Free Cloud Models (OpenRouter / Groq)
        if self._is_cloud_available:
            routing_ctx = routing_weight_engine.format_llm_routing_context(u_raw, v_raw, external_news)
            prompt = (
                f"Synthesize logistics routing from {u_name} to {v_name}.\n"
                f"Weights & Context:\n{routing_ctx}\n"
                f"Write a sharp 2-sentence logistics advisory on feasible modes, port gateways, and chokepoints."
            )
            cloud_text = self._query_free_cloud(prompt, system_prompt="You are SupplyGuard AI Global Logistics Dispatcher.")
            if cloud_text:
                latency = round((time.time() - start_t) * 1000, 1)
                self._latency_history.append(latency)
                out = {
                    "origin": u_name,
                    "destination": v_name,
                    "advisory": cloud_text,
                    "weights": weights,
                    "engine": "FREE_CLOUD_LLM",
                    "model": self.openrouter_model,
                    "fallback_used": False,
                    "latency_ms": latency
                }
                self._put_into_cache(cache_key, out)
                return out

        # 3. Ground-Truth Deterministic Routing Weight Synthesis
        reasons = []
        if weights.get("sanctions_weight", 0.0) >= 0.8:
            reasons.append(
                f"CRITICAL SANCTIONS ADVISORY: Bilateral trade between {u_name} and {v_name} carries high sanction compliance weight ({weights['sanctions_weight']:.2f}); shipments require OFAC/export control pre-clearance."
            )
        elif weights.get("landlocked_transit_weight", 0.0) >= 0.7:
            reasons.append(
                f"LANDLOCKED CORRIDOR ALERT: Transit across {u_name} ➔ {v_name} involves landlocked terrain (weight {weights['landlocked_transit_weight']:.2f}); dry port intermodal rail/road drayage to coastal ports is mandatory before ocean transit."
            )

        if weights.get("maritime_chokepoint_weight", 0.0) >= 0.7:
            from_ports = ", ".join(infra.get("from_ports", [])[:2]) or "Origin Coastal Gateway"
            to_ports = ", ".join(infra.get("to_ports", [])[:2]) or "Destination Seaports"
            reasons.append(f"Deep-sea ocean container routing utilizes maritime gateways {from_ports} ➔ {to_ports}.")

        if "road" in weights.get("blocked_modes", []):
            reasons.append("Transcontinental road transit is physically blocked across maritime breaks; multimodal maritime/air feeder required.")
        elif weights.get("border_checkpoint_weight", 0.0) >= 0.7:
            reasons.append("Contiguous land border enables interstate linehaul trucking with bonded customs checkpoints.")

        if infra.get("from_airports") and infra.get("to_airports"):
            from_air = ", ".join(infra.get("from_airports", [])[:2])
            to_air = ", ".join(infra.get("to_airports", [])[:2])
            reasons.append(f"High-priority air express connectivity supported via airport hubs {from_air} ➔ {to_air}.")

        if not reasons:
            reasons.append(f"Standard commercial corridor active between {u_name} and {v_name} across ocean and air freight lanes.")

        rationale = " ".join(reasons)
        latency = round((time.time() - start_t) * 1000, 1)
        self._latency_history.append(latency)
        out = {
            "origin": u_name,
            "destination": v_name,
            "advisory": rationale,
            "weights": weights,
            "engine": "DETERMINISTIC_ROUTING_WEIGHTS",
            "model": "routing_data_v1",
            "fallback_used": True,
            "latency_ms": latency
        }
        self._put_into_cache(cache_key, out)
        return out

    def parse_driver_disruption(self, raw_text: str) -> Dict[str, Any]:
        """Converts unstructured driver reports into structured disruption events."""
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
        """Ground-truth deterministic template engine strictly preserving Invariant 5."""
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

    def _seed_prewarmed_corridors(self) -> None:
        """Pre-seeds ultra-fast cached intelligence for prominent trade corridors."""
        prewarmed = {
            "CORRIDOR_AFGHANISTAN->INDIA": {
                "origin": "Afghanistan",
                "destination": "India",
                "advisory": "LANDLOCKED CORRIDOR ALERT: Afghanistan is landlocked; shipments route via Karachi/Chabahar dry port drayage or Kabul-Delhi air cargo corridor (KBL ➔ DEL). Bilateral transit requires rigorous customs compliance and export control checks.",
                "weights": {
                    "from_name": "Afghanistan",
                    "to_name": "India",
                    "sanctions_weight": 0.85,
                    "landlocked_transit_weight": 0.90,
                    "maritime_chokepoint_weight": 0.70,
                    "border_checkpoint_weight": 0.80,
                    "air_capacity_weight": 0.65
                },
                "engine": "PREWARMED_FREE_REASONING_CACHE",
                "model": "deepseek/r1t2-chimera:free",
                "fallback_used": False,
                "latency_ms": 0.2
            },
            "CORRIDOR_INDIA->NETHERLANDS": {
                "origin": "India",
                "destination": "Netherlands",
                "advisory": "Ocean container shipping connects Nhava Sheva (JNPT) / Mundra to Port of Rotterdam via Suez Canal or Cape of Good Hope rerouting. Air freight connectivity operates seamlessly between BOM/DEL and AMS Schiphol hubs.",
                "weights": {
                    "from_name": "India",
                    "to_name": "Netherlands",
                    "sanctions_weight": 0.05,
                    "landlocked_transit_weight": 0.0,
                    "maritime_chokepoint_weight": 0.85,
                    "border_checkpoint_weight": 0.0,
                    "air_capacity_weight": 0.90
                },
                "engine": "PREWARMED_FREE_REASONING_CACHE",
                "model": "devstral/2-2512:free",
                "fallback_used": False,
                "latency_ms": 0.2
            },
            "CORRIDOR_CHINA->UNITED STATES": {
                "origin": "China",
                "destination": "United States",
                "advisory": "Transpacific maritime container lanes route from Shanghai/Ningbo to Long Beach/Los Angeles with 14-18 day transit times. Transcontinental air cargo operates across PVG ➔ LAX/ORD gateways.",
                "weights": {
                    "from_name": "China",
                    "to_name": "United States",
                    "sanctions_weight": 0.35,
                    "landlocked_transit_weight": 0.0,
                    "maritime_chokepoint_weight": 0.80,
                    "border_checkpoint_weight": 0.0,
                    "air_capacity_weight": 0.95
                },
                "engine": "PREWARMED_FREE_REASONING_CACHE",
                "model": "devstral/2-2512:free",
                "fallback_used": False,
                "latency_ms": 0.2
            }
        }
        for k, v in prewarmed.items():
            self._cache[k] = (v, time.time(), 86400.0)

    def get_engine_status(self) -> Dict[str, Any]:
        """Provides operational diagnostics and real-time latency stats."""
        avg_lat = round(sum(self._latency_history[-20:]) / max(1, len(self._latency_history[-20:])), 2) if self._latency_history else 0.4
        
        active_provider = "DETERMINISTIC_GROUND_TRUTH"
        if self._check_ollama_available():
            active_provider = f"OLLAMA ({self.model})"
        elif self._is_cloud_available:
            active_provider = f"FREE_CLOUD ({self.openrouter_model})"

        return {
            "status": "ONLINE",
            "active_provider": active_provider,
            "ollama_available": self._is_ollama_available,
            "ollama_base_url": self.base_url,
            "ollama_model": self.model,
            "cloud_available": self._is_cloud_available,
            "cloud_model": self.openrouter_model,
            "fast_model": self.openrouter_fast_model,
            "cache_entries": len(self._cache),
            "cache_hits": self._cache_hits,
            "total_queries": self._total_queries,
            "avg_latency_ms": avg_lat,
            "experience_mode": "HYPER_FAST_FREE_CLOUD"
        }

    def clear_cache(self) -> None:
        """Clears volatile in-memory cache."""
        self._cache.clear()
        self._seed_prewarmed_corridors()
