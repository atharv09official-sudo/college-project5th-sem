import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.entities import SalesObservation, Store, Product
from app.schemas.forecast import ForecastRunRequest, ForecastRunResponse
from models.weekly_quantile_forecaster import (
    WeeklyQuantileForecaster,
    ZeroLeakageChronologicalSplitter,
    FeatureEngineer,
)
from models.anomaly_detector import DemandAnomalyDetector

router = APIRouter(prefix="/forecasts", tags=["Demand Forecasting & Anomaly Detection"])


@router.post("/run", response_model=ForecastRunResponse)
def run_forecast_benchmark(payload: ForecastRunRequest, db: Session = Depends(get_db)):
    """
    Module 2 & 3: Multi-Quantile Forecasting with 5% Relative WAPE Gate
    and Isolation Forest Anomaly / Shock Detection.
    """
    query = db.query(
        SalesObservation.store_id,
        SalesObservation.product_id,
        SalesObservation.observation_date,
        SalesObservation.units_sold,
        SalesObservation.is_promo
    )
    if payload.store_id:
        query = query.filter(SalesObservation.store_id == payload.store_id)
    if payload.product_id:
        query = query.filter(SalesObservation.product_id == payload.product_id)

    records = query.all()
    if not records:
        raise HTTPException(status_code=400, detail="Insufficient historical sales observations found")

    df = pd.DataFrame([{
        "store_id": r.store_id,
        "product_id": r.product_id,
        "observation_date": r.observation_date,
        "units_sold": r.units_sold,
        "is_promo": r.is_promo
    } for r in records])

    # 1. Run Demand Anomaly & Shock Detection
    anomaly_detector = DemandAnomalyDetector(contamination=0.03, random_state=42)
    df_clean, anomaly_summary = anomaly_detector.fit_detect_and_clamp(df, target_col="units_sold")

    # 2. Extract strictly backward features (Zero-Leakage)
    df_features = FeatureEngineer.extract_features(df_clean, target_col="clamped_demand")

    # 3. Chronological zero-leakage split
    train_df, val_df, test_df = ZeroLeakageChronologicalSplitter.split(df_features)

    # 4. Train Weekly Quantile Forecaster & Evaluate against Seasonal Naive Baseline
    forecaster = WeeklyQuantileForecaster(quantiles=payload.quantiles)
    eval_result = forecaster.train_and_evaluate(train_df, val_df, target_col="clamped_demand")

    # Generate sample quantile predictions on test holdout
    preds = forecaster.predict_quantiles(test_df.iloc[:5])
    sample_preview = []
    for i in range(min(5, len(test_df))):
        row = test_df.iloc[i]
        sample_preview.append({
            "date": str(row["observation_date"])[:10],
            "store_id": int(row["store_id"]),
            "product_id": int(row["product_id"]),
            "actual_units": int(row["units_sold"]),
            "p10": float(preds["p10"][i]),
            "p50_median": float(preds["p50"][i]),
            "p80": float(preds["p80"][i]),
            "p90": float(preds["p90"][i]),
            "p95": float(preds["p95"][i])
        })

    return {
        "baseline_wape": eval_result["baseline_wape"],
        "model_wape": eval_result["model_wape"],
        "relative_improvement": eval_result["relative_improvement"],
        "relative_improvement_pct": eval_result["relative_improvement_pct"],
        "gate_passed": eval_result["gate_passed"],
        "decision": eval_result["decision"],
        "anomaly_summary": anomaly_summary,
        "predictions_sample": sample_preview
    }
