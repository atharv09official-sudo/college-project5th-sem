import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple
from sklearn.ensemble import IsolationForest


class DemandAnomalyDetector:
    """
    Demand Anomaly & Shock Detector using Isolation Forest.
    Detects flash sales, promotional data spikes, or data collection errors.
    Automatically clamps flagged spikes to the 95th percentile historical cap.
    """
    def __init__(self, contamination: float = 0.03, random_state: int = 42):
        self.contamination = contamination
        self.random_state = random_state
        self.model = IsolationForest(
            contamination=self.contamination,
            random_state=self.random_state,
            n_estimators=100
        )

    def fit_detect_and_clamp(self, df: pd.DataFrame, target_col: str = "units_sold") -> Tuple[pd.DataFrame, Dict[str, Any]]:
        df_out = df.copy()
        values = df_out[[target_col]].values

        # 1. Fit Isolation Forest
        preds = self.model.fit_predict(values)  # -1 for anomaly, 1 for normal
        is_anomaly = (preds == -1)

        # 2. Compute 95th percentile cap
        p95_cap = float(np.percentile(values, 95))

        # 3. Detect and clamp spikes to the 95th percentile cap
        is_spike = is_anomaly & (df_out[target_col] > p95_cap)
        num_spikes = int(np.sum(is_spike))

        df_out["is_anomaly"] = is_anomaly
        df_out["is_spike"] = is_spike
        df_out["clamped_demand"] = np.minimum(df_out[target_col].values, p95_cap)

        summary = {
            "total_records": len(df_out),
            "anomalies_detected": int(np.sum(is_anomaly)),
            "demand_spikes_clamped": num_spikes,
            "p95_cap_value": round(p95_cap, 2),
            "status": "CLAMPED" if num_spikes > 0 else "NORMAL"
        }
        return df_out, summary
