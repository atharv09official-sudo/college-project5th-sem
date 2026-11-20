import numpy as np
from typing import Dict, Any, List
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor


class MaharashtraRoadRiskPredictor:
    """
    Maharashtra Road-Risk & Transit Delay Intelligence:
    - Predicts transit delays in minutes for key Maharashtra transit corridors
      (including Western Ghat routes: Khandala, Kasara, Bhor).
    - Classifies hazard severity: LOW, MEDIUM, HIGH.
    - Computes dynamic freight surcharges based on diesel price deltas and weather delays.
    """
    def __init__(
        self,
        base_diesel_price: float = 92.50,
        alpha_fuel: float = 0.40,
        beta_delay: float = 0.15
    ):
        self.base_diesel_price = base_diesel_price
        self.alpha_fuel = alpha_fuel
        self.beta_delay = beta_delay

        # Regressor for transit delay minutes
        self.delay_regressor = GradientBoostingRegressor(n_estimators=60, random_state=42)
        # Classifier for hazard severity
        self.hazard_classifier = RandomForestClassifier(n_estimators=50, random_state=42)
        self._fit_default_baseline()

    def _fit_default_baseline(self):
        """Fit realistic synthetic baseline calibrated on Western Ghats monsoon conditions."""
        rng = np.random.RandomState(42)
        n_samples = 400

        # Features: [rainfall_mm, visibility_km, pothole_index, waterlogging_flag, traffic_index, is_ghat_route]
        rainfall = rng.uniform(0.0, 150.0, n_samples)
        visibility = rng.uniform(1.0, 15.0, n_samples)
        potholes = rng.uniform(0.0, 1.0, n_samples)
        waterlogging = (rainfall > 60.0).astype(float)
        traffic = rng.uniform(0.1, 1.0, n_samples)
        is_ghat = rng.choice([0.0, 1.0], size=n_samples, p=[0.6, 0.4])

        X = np.column_stack([rainfall, visibility, potholes, waterlogging, traffic, is_ghat])

        # Delay equation with ghat vulnerability multiplier
        delay_min = (
            (rainfall * 0.4) +
            ((15.0 - visibility) * 2.5) +
            (potholes * 30.0) +
            (waterlogging * 45.0) +
            (traffic * 50.0) +
            (is_ghat * 60.0) +
            rng.normal(0, 5, n_samples)
        )
        delay_min = np.maximum(0.0, delay_min)

        # Hazard classes: LOW (< 30 min), MEDIUM (30-75 min), HIGH (> 75 min)
        hazard_classes = []
        for d in delay_min:
            if d < 35.0:
                hazard_classes.append("LOW")
            elif d < 80.0:
                hazard_classes.append("MEDIUM")
            else:
                hazard_classes.append("HIGH")

        self.delay_regressor.fit(X, delay_min)
        self.hazard_classifier.fit(X, hazard_classes)

    def predict(
        self,
        rainfall_mm: float,
        visibility_km: float,
        pothole_or_surface_risk_index: float,
        waterlogging_flag: int,
        traffic_congestion_index: float,
        is_ghat_route: bool,
        base_freight: float = 1000.0,
        current_diesel_price: float = 94.0
    ) -> Dict[str, Any]:
        X_input = np.array([[
            float(rainfall_mm),
            float(visibility_km),
            float(pothole_or_surface_risk_index),
            float(waterlogging_flag),
            float(traffic_congestion_index),
            1.0 if is_ghat_route else 0.0
        ]])

        delay_minutes = float(np.round(self.delay_regressor.predict(X_input)[0], 1))
        delay_minutes = max(0.0, delay_minutes)

        hazard_class = str(self.hazard_classifier.predict(X_input)[0])
        probabilities = self.hazard_classifier.predict_proba(X_input)[0]
        hazard_confidence = float(np.round(np.max(probabilities), 2))

        # Dynamic Surcharge Calculation
        # Adjusted Freight = Base Freight * (1.0 + alpha * delta_diesel / base_diesel + beta * delay_min / 60)
        delta_diesel = max(0.0, current_diesel_price - self.base_diesel_price)
        fuel_surcharge_factor = self.alpha_fuel * (delta_diesel / self.base_diesel_price)
        delay_surcharge_factor = self.beta_delay * (delay_minutes / 60.0)
        total_surcharge_multiplier = 1.0 + fuel_surcharge_factor + delay_surcharge_factor

        adjusted_freight = float(np.round(base_freight * total_surcharge_multiplier, 2))
        fuel_surcharge_amount = float(np.round(base_freight * fuel_surcharge_factor, 2))
        delay_surcharge_amount = float(np.round(base_freight * delay_surcharge_factor, 2))

        return {
            "predicted_delay_minutes": delay_minutes,
            "predicted_delay_hours": round(delay_minutes / 60.0, 2),
            "hazard_severity": hazard_class,
            "hazard_confidence": hazard_confidence,
            "is_ghat_corridor": is_ghat_route,
            "base_freight": base_freight,
            "adjusted_freight": adjusted_freight,
            "fuel_surcharge": fuel_surcharge_amount,
            "delay_surcharge": delay_surcharge_amount,
            "surcharge_pct": round((total_surcharge_multiplier - 1.0) * 100, 1),
            "recommendation": (
                "REROUTE_OR_DELAY_DISPATCH" if hazard_class == "HIGH"
                else "DISPATCH_WITH_GHAT_CAUTION" if is_ghat_route and hazard_class == "MEDIUM"
                else "PROCEED_NORMAL_DISPATCH"
            )
        }
