import os
from pydantic import BaseModel


class Settings(BaseModel):
    PROJECT_NAME: str = "HETVAYA FlowGrid"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "flowgrid_super_secret_jwt_key_2026_triwizathon")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./src/data/flowgrid.db")

    # Optimization & Safety Stock
    SERVICE_LEVEL_Z: float = 1.65  # 95% service level
    SHORTAGE_PENALTY_PER_UNIT: float = 150.0  # ₹150/unit soft slack penalty
    SOLVER_TIMEOUT_SECONDS: int = 8
    MIN_ARRIVAL_SHELF_LIFE_RATIO: float = 0.70  # 70% remaining shelf-life at arrival

    # Forecasting
    WAPE_RELATIVE_IMPROVEMENT_GATE: float = 0.05  # 5% relative improvement

    # Road Risk & Decision Guard
    BASE_DIESEL_PRICE: float = 92.50  # ₹/liter in Maharashtra
    ALPHA_FUEL_SURCHARGE: float = 0.40
    BETA_DELAY_SURCHARGE: float = 0.15
    STALE_EVENT_CUTOFF_MINUTES: int = 60
    MATERIALITY_THRESHOLD_PCT: float = 0.02  # 2% route margin

    # Ollama LLM
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3.2:latest")
    OLLAMA_TIMEOUT_SECONDS: int = 35

    # Twilio / External
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "mock_sid")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "mock_token")
    TWILIO_FROM_PHONE: str = os.getenv("TWILIO_FROM_PHONE", "+15005550006")
    SERPAPI_API_KEY: str = os.getenv("SERPAPI_API_KEY", "mock_key")


settings = Settings()
