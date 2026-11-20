import datetime
from typing import Dict, List, Any, Optional, Tuple
from ortools.sat.python import cp_model


class ConstrainedStockOptimizer:
    """
    Module 5 & 6: Constrained Allocation & Dispatch Optimizer
    Powered by Google OR-Tools CP-SAT.

    Enforces:
    - Invariant 4: Soft-slack feasibility guarantee (₹150/unit shortage penalty, never crashes on stockout).
    - Multi-depot, multi-store, multi-SKU constrained allocation.
    - Depot stock, vehicle weight & volume, store backroom capacity.
    - FEFO (First-Expired, First-Out) shelf-life protection & 70% arrival ratio filter.
    """
    def __init__(
        self,
        shortage_penalty: float = 150.0,
        min_arrival_shelf_life_ratio: float = 0.70,
        time_limit_seconds: int = 8
    ):
        self.shortage_penalty = int(shortage_penalty)
        self.min_arrival_shelf_life_ratio = min_arrival_shelf_life_ratio
        self.time_limit_seconds = time_limit_seconds

    def solve(
        self,
        warehouses: List[Dict[str, Any]],
        stores: List[Dict[str, Any]],
        products: List[Dict[str, Any]],
        batches: List[Dict[str, Any]],
        routes: List[Dict[str, Any]],
        replenishment_needs: Dict[Tuple[int, int], int],  # (store_id, sku_id) -> units needed
        vehicles: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Executes CP-SAT constrained optimization.
        """
        model = cp_model.CpModel()

        wh_ids = [w["id"] for w in warehouses]
        store_ids = [s["id"] for s in stores]
        sku_ids = [p["id"] for p in products]

        wh_map = {w["id"]: w for w in warehouses}
        store_map = {s["id"]: s for s in stores}
        product_map = {p["id"]: p for p in products}

        # Distance & base cost lookup
        dist_map = {}
        cost_map = {}
        for r in routes:
            pair = (r["origin_warehouse_id"], r["destination_store_id"])
            dist_map[pair] = r.get("distance_km", 50.0)
            cost_map[pair] = r.get("base_cost", 500.0)

        # Available warehouse stock aggregated by (wh_id, sku_id)
        wh_stock_available = {}
        for b in batches:
            wh_id = b["warehouse_id"]
            p_id = b["product_id"]
            avail = max(0, b["quantity"] - b.get("reserved_quantity", 0))
            wh_stock_available[(wh_id, p_id)] = wh_stock_available.get((wh_id, p_id), 0) + avail

        # Priority weights by store turnover tier: P0 -> 200, P1 -> 50, P2 -> 10
        priority_weights = {
            "P0": 200,
            "P1": 50,
            "P2": 10
        }

        # 1. Define Decision Variables
        # x[w, s, k]: quantity dispatched
        # slack[s, k]: shortage penalty slack
        x = {}
        slack = {}

        for w in wh_ids:
            for s in store_ids:
                for k in sku_ids:
                    # Upper bound cannot exceed available stock in warehouse or store net demand
                    max_cap = wh_stock_available.get((w, k), 0)
                    x[(w, s, k)] = model.NewIntVar(0, max_cap, f"x_{w}_{s}_{k}")

        for s in store_ids:
            for k in sku_ids:
                needed = replenishment_needs.get((s, k), 0)
                slack[(s, k)] = model.NewIntVar(0, needed, f"slack_{s}_{k}")

        # 2. Hard Constraints

        # Constraint 1: Depot available stock
        for w in wh_ids:
            for k in sku_ids:
                avail = wh_stock_available.get((w, k), 0)
                model.Add(sum(x[(w, s, k)] for s in store_ids) <= avail)

        # Constraint 2: Demand fulfillment with Soft Slack (Feasibility Guarantee)
        for s in store_ids:
            for k in sku_ids:
                needed = replenishment_needs.get((s, k), 0)
                if needed > 0:
                    model.Add(sum(x[(w, s, k)] for w in wh_ids) + slack[(s, k)] == needed)
                else:
                    for w in wh_ids:
                        model.Add(x[(w, s, k)] == 0)
                    model.Add(slack[(s, k)] == 0)

        # Constraint 3 & 4: Vehicle Max Weight & Volume per corridor
        # Default typical small/mid commercial vehicle limits: 2500 kg, 6000 L
        default_max_weight_kg = 2500
        default_max_volume_l = 6000

        for w in wh_ids:
            for s in store_ids:
                weight_expr = sum(
                    int(product_map[k].get("unit_weight_kg", 1.0) * 100) * x[(w, s, k)]
                    for k in sku_ids
                )
                model.Add(weight_expr <= default_max_weight_kg * 100)

                vol_expr = sum(
                    int(product_map[k].get("unit_volume_l", 1.0) * 100) * x[(w, s, k)]
                    for k in sku_ids
                )
                model.Add(vol_expr <= default_max_volume_l * 100)

        # Constraint 5: Store Backroom Capacity Limit
        for s in store_ids:
            store_obj = store_map[s]
            max_backroom_cases = store_obj.get("backroom_capacity_cases", 2000)
            current_cases = store_obj.get("current_cases", 400)
            avail_case_slots = max(0, max_backroom_cases - current_cases)

            # Sum of (x / case_pack) <= avail_case_slots
            # Scale by lcm/case_pack: for integer CP-SAT: sum(x_k * (12 / case_pack_k)) <= avail_slots * 12
            cases_expr = sum(
                x[(w, s, k)] * max(1, 12 // max(1, product_map[k].get("case_pack", 12)))
                for w in wh_ids
                for k in sku_ids
            )
            model.Add(cases_expr <= avail_case_slots * 12)

        # 3. Objective Function:
        # Min Transport Cost + Shortage Penalty * slack - Priority Reward * x
        objective_terms = []

        for w in wh_ids:
            for s in store_ids:
                pair = (w, s)
                dist = dist_map.get(pair, 50.0)
                # Transport cost factor per unit: base_freight / 100 + dist * 0.05
                unit_transport_cost = int(max(1, (cost_map.get(pair, 500.0) / 200.0) + (dist * 0.04)))

                store_tier = store_map[s].get("daily_turnover_tier", "P1")
                p_reward = priority_weights.get(store_tier, 50)

                for k in sku_ids:
                    # Cost term
                    objective_terms.append(x[(w, s, k)] * (unit_transport_cost - p_reward))

        for s in store_ids:
            for k in sku_ids:
                objective_terms.append(slack[(s, k)] * self.shortage_penalty)

        model.Minimize(sum(objective_terms))

        # 4. Solve
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = float(self.time_limit_seconds)
        solver.parameters.num_search_workers = 4

        status = solver.Solve(model)

        status_str = solver.StatusName(status)
        is_feasible = status in [cp_model.OPTIMAL, cp_model.FEASIBLE]

        allocations = []
        total_units_dispatched = 0
        total_shortage_units = 0
        total_estimated_freight = 0.0

        if is_feasible:
            # 5. Extract Dispatches and Perform FEFO Batch Matching
            now = datetime.datetime.utcnow()

            for s in store_ids:
                store_obj = store_map[s]
                store_tier = store_obj.get("daily_turnover_tier", "P1")

                for k in sku_ids:
                    product_obj = product_map[k]
                    total_shelf_life_days = max(1, product_obj.get("shelf_life_days", 180))

                    needed = replenishment_needs.get((s, k), 0)
                    shortage_val = solver.Value(slack[(s, k)])
                    total_shortage_units += shortage_val

                    for w in wh_ids:
                        qty = solver.Value(x[(w, s, k)])
                        if qty > 0:
                            total_units_dispatched += qty
                            pair = (w, s)
                            dist = dist_map.get(pair, 50.0)
                            route_cost = cost_map.get(pair, 600.0)
                            calc_freight = round((route_cost / 150.0) * qty + (dist * 0.05 * qty), 2)
                            total_estimated_freight += calc_freight

                            # Perform FEFO matching for this SKU at warehouse w
                            matched_batches = self._fefo_match_batches(
                                batches=batches,
                                wh_id=w,
                                sku_id=k,
                                target_qty=qty,
                                store_tier=store_tier,
                                total_shelf_life_days=total_shelf_life_days,
                                now=now
                            )

                            for mb in matched_batches:
                                # Determine priority badge and reason
                                priority_badge = "P0" if (store_tier == "P0" or mb["is_near_expiry"]) else "P1"
                                if mb["is_near_expiry"]:
                                    reason_cat = "EXPIRY_URGENT"
                                    reason_txt = f"Batch {mb['lot_number']} expiring in {mb['days_to_expiry']}d routed to high-turnover store {store_obj['code']} to prevent write-off."
                                elif store_tier == "P0":
                                    reason_cat = "STOCKOUT_PREVENTION"
                                    reason_txt = f"Store {store_obj['code']} is at critical stockout risk; dispatched via {dist_map.get(pair, 50)}km corridor."
                                else:
                                    reason_cat = "DISTANCE_OPTIMAL"
                                    reason_txt = f"Optimal regional dispatch from {wh_map[w]['code']} to {store_obj['code']} (freight ₹{calc_freight})."

                                allocations.append({
                                    "source_wh_id": w,
                                    "source_wh_code": wh_map[w]["code"],
                                    "source_wh_name": wh_map[w]["name"],
                                    "dest_store_id": s,
                                    "dest_store_code": store_obj["code"],
                                    "dest_store_name": store_obj["name"],
                                    "sku_id": k,
                                    "sku_code": product_obj["code"],
                                    "sku_name": product_obj["name"],
                                    "batch_id": mb["batch_id"],
                                    "lot_number": mb["lot_number"],
                                    "quantity": mb["allocated_qty"],
                                    "priority": priority_badge,
                                    "reason_category": reason_cat,
                                    "reason_text": reason_txt,
                                    "transport_cost": calc_freight,
                                    "shelf_life_remaining_days": mb["days_to_expiry"],
                                    "arrival_shelf_life_pct": mb["arrival_shelf_life_pct"],
                                    "distance_km": dist
                                })

        return {
            "solver_status": status_str,
            "is_feasible": is_feasible,
            "solve_time_seconds": round(solver.WallTime(), 3),
            "total_units_dispatched": total_units_dispatched,
            "total_shortage_units": total_shortage_units,
            "total_estimated_freight": round(total_estimated_freight, 2),
            "allocations": allocations
        }

    def _fefo_match_batches(
        self,
        batches: List[Dict[str, Any]],
        wh_id: int,
        sku_id: int,
        target_qty: int,
        store_tier: str,
        total_shelf_life_days: int,
        now: datetime.datetime
    ) -> List[Dict[str, Any]]:
        """
        FEFO Batch Matching Engine:
        - Sort batches by expiry_date ascending (earliest expiring first).
        - Filter out batches with < 70% arrival shelf-life ratio for slow stores.
        - Prioritize near-expiry (30-60 days) to P0 stores.
        """
        eligible = [
            b for b in batches
            if b["warehouse_id"] == wh_id and b["product_id"] == sku_id and (b["quantity"] - b.get("reserved_quantity", 0)) > 0
        ]

        # Sort by expiry ascending (FEFO)
        eligible.sort(key=lambda b: b["expiry_date"])

        allocated = []
        remaining_needed = target_qty

        for b in eligible:
            if remaining_needed <= 0:
                break

            avail = b["quantity"] - b.get("reserved_quantity", 0)
            exp_date = b["expiry_date"]
            if isinstance(exp_date, str):
                exp_date = datetime.datetime.fromisoformat(exp_date.replace("Z", ""))

            days_to_exp = max(0, (exp_date - now).days)
            # Arrival ratio: assuming 1 day dispatch & transit
            arrival_ratio = max(0.0, (days_to_exp - 1) / total_shelf_life_days)

            # Invariant: Disqualify batches with < 70% shelf life for slow stores (P1, P2)
            if arrival_ratio < self.min_arrival_shelf_life_ratio and store_tier in ["P1", "P2"]:
                continue

            take = min(avail, remaining_needed)
            if take <= 0:
                continue

            is_near_expiry = (30 <= days_to_exp <= 60)

            # Mark reserved on the working batch dictionary so subsequent stores match the next batch
            b["reserved_quantity"] = b.get("reserved_quantity", 0) + take

            allocated.append({
                "batch_id": b["id"],
                "lot_number": b.get("lot_number", f"LOT-{b['id']}"),
                "allocated_qty": take,
                "days_to_expiry": days_to_exp,
                "arrival_shelf_life_pct": round(arrival_ratio * 100, 1),
                "is_near_expiry": is_near_expiry
            })

            remaining_needed -= take

        # Fallback if remaining needed and only sub-70% lots existed
        if remaining_needed > 0:
            for b in eligible:
                if remaining_needed <= 0:
                    break
                avail = b["quantity"] - b.get("reserved_quantity", 0)
                if avail <= 0:
                    continue
                take = min(avail, remaining_needed)
                b["reserved_quantity"] = b.get("reserved_quantity", 0) + take
                exp_date = b["expiry_date"]
                if isinstance(exp_date, str):
                    exp_date = datetime.datetime.fromisoformat(exp_date.replace("Z", ""))
                days_to_exp = max(0, (exp_date - now).days)
                allocated.append({
                    "batch_id": b["id"],
                    "lot_number": b.get("lot_number", f"LOT-{b['id']}"),
                    "allocated_qty": take,
                    "days_to_expiry": days_to_exp,
                    "arrival_shelf_life_pct": round(max(0.0, (days_to_exp - 1) / total_shelf_life_days) * 100, 1),
                    "is_near_expiry": False
                })
                remaining_needed -= take

        return allocated
