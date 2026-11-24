from fastapi import APIRouter, HTTPException

from src.utils.energy_market import EnergyMarketError, get_energy_market_quotes

router = APIRouter(prefix="/energy-market", tags=["Energy Market"])


@router.get("")
def get_energy_market():
    try:
        return get_energy_market_quotes()
    except EnergyMarketError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error
