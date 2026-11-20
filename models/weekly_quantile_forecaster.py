import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Any, Optional
from sklearn.ensemble import HistGradientBoostingRegressor


class ZeroLeakageChronologicalSplitter:
    """
    Strictly enforces zero-leakage chronological boundaries:
    - Training: [T_0, T_train]
    - Validation: [T_train + 1, T_val]
    - Test: [T_val + 1, T_test]
    """
    @staticmethod
    def split(df: pd.DataFrame, date_col: str = "observation_date", train_ratio: float = 0.70, val_ratio: float = 0.15) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        df_sorted = df.sort_values(by=date_col).reset_index(drop=True)
        n = len(df_sorted)
        train_end = int(n * train_ratio)
        val_end = int(n * (train_ratio + val_ratio))

        train_df = df_sorted.iloc[:train_end].copy()
        val_df = df_sorted.iloc[train_end:val_end].copy()
        test_df = df_sorted.iloc[val_end:].copy()
        return train_df, val_df, test_df


class FeatureEngineer:
    """
    Generates lag and rolling statistics strictly backwards in time
    to prevent temporal lookahead bias.
    """
    @staticmethod
    def extract_features(df: pd.DataFrame, group_cols: List[str] = ["store_id", "product_id"], target_col: str = "units_sold") -> pd.DataFrame:
        df_out = df.copy()
        df_out = df_out.sort_values(by=group_cols + ["observation_date"]).reset_index(drop=True)

        grouped = df_out.groupby(group_cols)[target_col]

        # Strictly backward-looking lags
        df_out["lag_1"] = grouped.shift(1).bfill().fillna(0)
        df_out["lag_7"] = grouped.shift(7).bfill().fillna(0)
        df_out["lag_14"] = grouped.shift(14).bfill().fillna(0)
        df_out["lag_28"] = grouped.shift(28).bfill().fillna(0)

        # Strictly backward-looking rolling statistics (excluding current row via shift(1))
        df_out["rolling_mean_7"] = df_out.groupby(group_cols)[target_col].transform(
            lambda x: x.shift(1).rolling(window=7, min_periods=1).mean()
        ).fillna(0)
        df_out["rolling_std_28"] = df_out.groupby(group_cols)[target_col].transform(
            lambda x: x.shift(1).rolling(window=28, min_periods=1).std()
        ).fillna(0)

        # Calendar features
        df_out["day_of_week"] = pd.to_datetime(df_out["observation_date"]).dt.day_of_week
        df_out["is_weekend"] = df_out["day_of_week"].isin([5, 6]).astype(int)

        return df_out


class SeasonalNaiveBaseline:
    """
    Baseline model: Predicts demand using 7-day seasonal lag (t - 7).
    """
    def predict(self, df: pd.DataFrame, lag_col: str = "lag_7") -> np.ndarray:
        return np.maximum(0.0, df[lag_col].values.astype(float))


def calculate_wape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """
    Weighted Absolute Percentage Error (WAPE):
    WAPE = sum(|y - y_hat|) / sum(y)
    """
    denominator = np.sum(y_true)
    if denominator == 0:
        return 0.0
    return float(np.sum(np.abs(y_true - y_pred)) / denominator)


class WeeklyQuantileForecaster:
    """
    Multi-quantile forecaster predicting [p10, p50, p80, p90, p95]
    using HistGradientBoostingRegressor with pinball/quantile loss.
    Enforces the 5% Relative WAPE Gate against the Seasonal Naive baseline.
    """
    def __init__(self, quantiles: List[float] = [0.10, 0.50, 0.80, 0.90, 0.95]):
        self.quantiles = quantiles
        self.models: Dict[float, HistGradientBoostingRegressor] = {}
        self.feature_cols = ["lag_1", "lag_7", "lag_14", "lag_28", "rolling_mean_7", "rolling_std_28", "day_of_week", "is_weekend"]
        self.baseline = SeasonalNaiveBaseline()
        self.baseline_wape: Optional[float] = None
        self.model_wape: Optional[float] = None
        self.relative_improvement: Optional[float] = None
        self.gate_passed: bool = False

    def train_and_evaluate(self, train_df: pd.DataFrame, val_df: pd.DataFrame, target_col: str = "units_sold") -> Dict[str, Any]:
        X_train = train_df[self.feature_cols].values
        y_train = train_df[target_col].values

        X_val = val_df[self.feature_cols].values
        y_val = val_df[target_col].values

        # 1. Train quantile regressors
        for q in self.quantiles:
            model = HistGradientBoostingRegressor(
                loss="quantile",
                quantile=q,
                max_iter=100,
                learning_rate=0.08,
                random_state=42
            )
            model.fit(X_train, y_train)
            self.models[q] = model

        # 2. Evaluate Baseline on Validation Set
        y_baseline_pred = self.baseline.predict(val_df, lag_col="lag_7")
        self.baseline_wape = calculate_wape(y_val, y_baseline_pred)

        # 3. Evaluate p50 (median) ML Model on Validation Set
        p50_model = self.models[0.50]
        y_model_pred = np.maximum(0.0, p50_model.predict(X_val))
        self.model_wape = calculate_wape(y_val, y_model_pred)

        # 4. Adoption Decision Gate (>= 5% Relative WAPE Improvement)
        if self.baseline_wape > 0:
            self.relative_improvement = (self.baseline_wape - self.model_wape) / self.baseline_wape
        else:
            self.relative_improvement = 0.0

        self.gate_passed = self.relative_improvement >= 0.05

        return {
            "baseline_wape": round(self.baseline_wape, 4),
            "model_wape": round(self.model_wape, 4),
            "relative_improvement": round(self.relative_improvement, 4),
            "relative_improvement_pct": f"{round(self.relative_improvement * 100, 2)}%",
            "gate_passed": bool(self.gate_passed),
            "decision": "PROMOTE_ML_MODEL" if self.gate_passed else "RETAIN_SEASONAL_NAIVE_BASELINE"
        }

    def predict_quantiles(self, df: pd.DataFrame) -> Dict[str, np.ndarray]:
        X = df[self.feature_cols].values
        predictions = {}
        for q, model in self.models.items():
            key = f"p{int(q * 100)}"
            predictions[key] = np.maximum(0.0, np.round(model.predict(X), 1))
        return predictions
