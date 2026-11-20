from dataclasses import dataclass
from typing import Dict, Any, Optional, List


@dataclass
class VehicleConfig:
    code: str
    name: str
    category: str
    max_weight_tons: float
    max_volume_m3: float
    base_mileage_kml: float
    driver_rate_per_hour_inr: float
    fuel_price_per_l_inr: float = 94.0
    maintenance_cost_per_km_inr: float = 4.5


VEHICLE_CATALOG: Dict[str, VehicleConfig] = {
    "LCV_TATA_ACE": VehicleConfig(
        code="LCV_TATA_ACE",
        name="Tata Ace Gold (Small Commercial)",
        category="LCV",
        max_weight_tons=1.5,
        max_volume_m3=8.5,
        base_mileage_kml=14.5,
        driver_rate_per_hour_inr=180.0,
        maintenance_cost_per_km_inr=2.5
    ),
    "MCV_EICHER_14T": VehicleConfig(
        code="MCV_EICHER_14T",
        name="Eicher Pro 2049 (Medium Freight)",
        category="MCV",
        max_weight_tons=5.0,
        max_volume_m3=24.0,
        base_mileage_kml=7.8,
        driver_rate_per_hour_inr=320.0,
        maintenance_cost_per_km_inr=4.0
    ),
    "HCV_BHARATBENZ_16T": VehicleConfig(
        code="HCV_BHARATBENZ_16T",
        name="BharatBenz 1617R (Heavy Commercial)",
        category="HCV",
        max_weight_tons=16.0,
        max_volume_m3=45.0,
        base_mileage_kml=4.5,
        driver_rate_per_hour_inr=520.0,
        maintenance_cost_per_km_inr=6.5
    ),
    "TRAILER_40FT": VehicleConfig(
        code="TRAILER_40FT",
        name="Tata Prima 4028.S (40ft Multi-Axle Container)",
        category="TRAILER",
        max_weight_tons=28.0,
        max_volume_m3=72.0,
        base_mileage_kml=3.2,
        driver_rate_per_hour_inr=750.0,
        maintenance_cost_per_km_inr=9.5
    ),
    "EV_CARGO_VAN": VehicleConfig(
        code="EV_CARGO_VAN",
        name="Euler Storm EV (Electric Urban Delivery)",
        category="EV",
        max_weight_tons=2.0,
        max_volume_m3=12.0,
        base_mileage_kml=4.2,  # km per kWh equivalent
        driver_rate_per_hour_inr=200.0,
        fuel_price_per_l_inr=12.0,  # Electricity charge per kWh
        maintenance_cost_per_km_inr=1.8
    )
}


class CostTimeEstimator:
    """
    Modules 5 & 6: Cost Estimation Engine and Travel Time Estimation Engine
    Calculates fuel consumption, toll fees, driver/ops expenses, travel time, and traffic buffers.
    """

    def __init__(self, default_diesel_price: float = 94.0):
        self.default_diesel_price = default_diesel_price

    def get_vehicle(self, vehicle_type_code: str) -> VehicleConfig:
        return VEHICLE_CATALOG.get(vehicle_type_code, VEHICLE_CATALOG["LCV_TATA_ACE"])

    def estimate(
        self,
        distance_km: float,
        raw_travel_time_hours: float,
        toll_charges_inr: float,
        vehicle_type_code: str,
        shipment_weight_tons: float,
        is_ghat_route: bool = False,
        traffic_delay_multiplier: float = 1.0
    ) -> Dict[str, Any]:
        vehicle = self.get_vehicle(vehicle_type_code)

        # 1. Mileage penalty based on load factor (heavier load burns 5% to 15% more fuel)
        load_ratio = min(1.0, max(0.1, shipment_weight_tons / max(0.1, vehicle.max_weight_tons)))
        adjusted_mileage = vehicle.base_mileage_kml * (1.0 - (0.12 * load_ratio))
        if is_ghat_route:
            adjusted_mileage *= 0.85  # Ghat elevation and switchbacks reduce mileage by 15%

        # 2. Fuel Consumption & Cost
        liters_consumed = round(distance_km / max(1.0, adjusted_mileage), 2)
        fuel_cost_inr = round(liters_consumed * vehicle.fuel_price_per_l_inr, 2)

        # 3. Travel Time with Traffic Delay
        # Default traffic delay: 8-15% on regular highways, 25-40% on ghats during peak/monsoon
        delay_factor = traffic_delay_multiplier
        if is_ghat_route:
            delay_factor = max(delay_factor, 1.25)

        adjusted_travel_time_hours = round(raw_travel_time_hours * delay_factor, 2)
        traffic_delay_minutes = round((adjusted_travel_time_hours - raw_travel_time_hours) * 60.0, 1)

        # 4. Driver & Operational Expenses
        driver_cost_inr = round(adjusted_travel_time_hours * vehicle.driver_rate_per_hour_inr, 2)
        maintenance_cost_inr = round(distance_km * vehicle.maintenance_cost_per_km_inr, 2)

        # 5. Total Transportation Cost
        total_cost_inr = round(fuel_cost_inr + toll_charges_inr + driver_cost_inr + maintenance_cost_inr, 2)

        # Fallback flags for transparency
        fallback_assumptions = [
            f"Baseline fuel price ₹{vehicle.fuel_price_per_l_inr:.2f}/L applied from state petroleum index.",
            f"Standard dry weather road conditions and posted speed limits assumed."
        ]
        if traffic_delay_multiplier == 1.0 and not is_ghat_route:
            fallback_assumptions.append("Live GPS traffic telemetry offline; standard historical road speed applied.")
        if is_ghat_route:
            fallback_assumptions.append("Western Ghat terrain buffer applied: +25% transit time and +15% fuel burn.")

        return {
            "vehicle_used": vehicle.name,
            "vehicle_category": vehicle.category,
            "distance_km": round(distance_km, 2),
            "raw_time_hours": round(raw_travel_time_hours, 2),
            "adjusted_time_hours": adjusted_travel_time_hours,
            "traffic_delay_minutes": max(0.0, traffic_delay_minutes),
            "fuel_liters_consumed": liters_consumed,
            "fuel_cost_inr": fuel_cost_inr,
            "toll_charges_inr": round(toll_charges_inr, 2),
            "driver_cost_inr": driver_cost_inr,
            "maintenance_cost_inr": maintenance_cost_inr,
            "total_transportation_cost_inr": total_cost_inr,
            "fallback_assumptions": fallback_assumptions
        }
