from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.plans import router as plans_router
from app.api.v1.inventory import router as inventory_router
from app.api.v1.forecasts import router as forecasts_router
from app.api.v1.ai import router as ai_router
from app.api.v1.decision_guard import router as decision_guard_router
from app.api.v1.master_data import router as master_data_router
from app.api.v1.pos import router as pos_router
from app.api.v1.trade_routes import router as trade_routes_router
from app.api.v1.energy_market import router as energy_market_router

api_v1_router = APIRouter(prefix="/api/v1")
api_v1_router.include_router(auth_router)
api_v1_router.include_router(plans_router)
api_v1_router.include_router(inventory_router)
api_v1_router.include_router(forecasts_router)
api_v1_router.include_router(ai_router)
api_v1_router.include_router(decision_guard_router)
api_v1_router.include_router(master_data_router)
api_v1_router.include_router(pos_router)
api_v1_router.include_router(trade_routes_router)
api_v1_router.include_router(energy_market_router)

__all__ = ["api_v1_router"]
