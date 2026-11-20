import datetime
import json
import csv
import io
from typing import Dict, Any, List


class TradeRouteReportGenerator:
    """
    Module 11: Report Generation Engine
    Generates academic and executive route summaries in Markdown, CSV, and HTML format.
    Includes project credentials and multi-criteria comparison matrix.
    """

    ACADEMIC_METADATA = {
        "project_name": "AI-Powered Smart Trade Route Optimization System",
        "academic_level": "Third Year B.Tech AIML, Semester V (Academic Year 2026–27)",
        "institution": "D. Y. Patil Agriculture & Technical University, Talsande",
        "department": "Department of Computer Science & Engineering (AIML)",
        "project_guide": "Mr. R. S. Todkar",
        "team_members": [
            {"name": "Atharv Chandrakant Jadhav", "prn": "2025011042044"},
            {"name": "Harshwardhan Yashwantrao Mohite", "prn": "2025011042014"},
            {"name": "Suraj Sunil Shewale", "prn": "2025011042033"},
            {"name": "Rajvardhan Sambhaji Jadhav", "prn": "2025011042013"},
            {"name": "Abubakharsiddik Shakil Tanekhan", "prn": "2024011041126"},
            {"name": "Mansi Suresh Chougule", "prn": "2025011042033"}
        ],
        "student_team": [
            {"name": "Atharv Chandrakant Jadhav", "prn": "2025011042044"},
            {"name": "Harshwardhan Yashwantrao Mohite", "prn": "2025011042014"},
            {"name": "Suraj Sunil Shewale", "prn": "2025011042033"},
            {"name": "Rajvardhan Sambhaji Jadhav", "prn": "2025011042013"},
            {"name": "Abubakharsiddik Shakil Tanekhan", "prn": "2024011041126"},
            {"name": "Mansi Suresh Chougule", "prn": "2025011042033"}
        ]
    }

    @classmethod
    def generate_text_summary(cls, optimization_result: Dict[str, Any]) -> str:
        """Generates comprehensive text/markdown executive route summary."""
        req = optimization_result.get("shipment_request", {})
        routes = optimization_result.get("ranked_routes", [])
        recommended = routes[0] if routes else {}

        meta = cls.ACADEMIC_METADATA
        now = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

        lines = [
            "=" * 78,
            f"  {meta['project_name'].upper()}",
            f"  {meta['institution']} | {meta['department']}",
            f"  Guide: {meta['project_guide']} | Academic Year: 2026–27",
            "=" * 78,
            f"Report Generated: {now}",
            f"Request Code:     {req.get('request_code', 'N/A')}",
            "",
            "1. SHIPMENT & VEHICLE MISSION PARAMETERS",
            f"  - Origin Location:       {req.get('origin_name')} ({req.get('origin_id')})",
            f"  - Destination Location:  {req.get('destination_name')} ({req.get('destination_id')})",
            f"  - Cargo Payload Weight:  {req.get('shipment_weight_kg', 0):,.1f} kg ({req.get('shipment_weight_kg', 0)/1000.0:.2f} Tons)",
            f"  - Cargo Volume:          {req.get('shipment_volume_m3', 0):.2f} m3",
            f"  - Designated Vehicle:    {req.get('vehicle_name')} ({req.get('vehicle_type')})",
            f"  - Vehicle Max Capacity:  {req.get('vehicle_capacity_tons', 0):.1f} Tons / {req.get('vehicle_capacity_m3', 0):.1f} m3",
            f"  - Delivery Deadline:     {req.get('delivery_deadline_hours')} hours" if req.get('delivery_deadline_hours') else "  - Delivery Deadline:     No rigid deadline specified",
            f"  - Optimization Weights:  Time: {req.get('weight_time', 0.35)*100:.0f}%, Cost: {req.get('weight_cost', 0.35)*100:.0f}%, Dist: {req.get('weight_dist', 0.15)*100:.0f}%, Risk: {req.get('weight_risk', 0.15)*100:.0f}%",
            "",
            "2. RECOMMENDED OPTIMAL TRADE ROUTE",
            f"  - Route Designation:     {recommended.get('name', 'N/A')}",
            f"  - Search Algorithm:      {recommended.get('algorithm', 'A*')} (Admissible Haversine Heuristic)",
            f"  - Total Road Distance:   {recommended.get('distance_km', 0):.1f} km",
            f"  - Estimated Travel Time: {recommended.get('travel_time_hours', 0):.2f} hours ({recommended.get('travel_time_hours', 0)*60:.0f} mins)",
            f"  - Total Freight Cost:    INR {recommended.get('total_cost_inr', 0):,.2f}",
            f"      * Fuel Expense:      INR {recommended.get('cost_breakdown', {}).get('fuel_cost_inr', 0):,.2f}",
            f"      * Toll Charges:      INR {recommended.get('cost_breakdown', {}).get('toll_charges_inr', 0):,.2f}",
            f"      * Operational/Labor: INR {recommended.get('cost_breakdown', {}).get('driver_cost_inr', 0):,.2f}",
            f"  - Corridor Hazard Score: {recommended.get('risk_score', 0):.2f} / 10.0",
            f"  - Multi-Objective Score: {recommended.get('multi_objective_score', 0):.4f} (Rank 1 - Lowest Score)",
            f"  - Waypoints Sequence:    {' -> '.join(recommended.get('path_names', []))}",
            f"  - Recommendation Logic:  {recommended.get('explanation', 'N/A')}",
            "",
            "3. CANDIDATE ROUTE COMPARISON MATRIX",
            f"{'Route Option':<32} | {'Algorithm':<10} | {'Dist (km)':<10} | {'Time (h)':<9} | {'Cost (INR)':<13} | {'Risk':<6} | {'Score':<7}"
            f"\n{'-'*32}-+-{'-'*10}-+-{'-'*10}-+-{'-'*9}-+-{'-'*13}-+-{'-'*6}-+-{'-'*7}"
        ]

        for r in routes:
            prefix = "[*] " if r.get("is_recommended") else "    "
            line = (
                f"{prefix + r['name'][:28]:<32} | "
                f"{r.get('algorithm', 'N/A'):<10} | "
                f"{r['distance_km']:<10.1f} | "
                f"{r['travel_time_hours']:<9.2f} | "
                f"{r['total_cost_inr']:<13,.2f} | "
                f"{r['risk_score']:<6.2f} | "
                f"{r['multi_objective_score']:<7.4f}"
            )
            lines.append(line)

        # Warnings & Fallbacks
        all_warnings = []
        for r in routes:
            all_warnings.extend(r.get("warnings", []))
        all_warnings = list(dict.fromkeys(all_warnings))  # unique

        if all_warnings:
            lines.append("\n4. OPERATIONAL ALERTS & CORRIDOR WARNINGS:")
            for w in all_warnings:
                lines.append(f"  [!] {w}")

        lines.extend([
            "",
            "5. PROJECT CREDITS & VERIFICATION:",
            f"  Institution: {cls.ACADEMIC_METADATA['institution']}",
            f"  Department:  {cls.ACADEMIC_METADATA['department']}",
            f"  Guide:       {cls.ACADEMIC_METADATA['project_guide']}",
            "  Student Team Members:"
        ])
        for m in cls.ACADEMIC_METADATA["team_members"]:
            lines.append(f"    - {m['name']} (PRN: {m['prn']})")
        lines.append("=" * 78)

        return "\n".join(lines)

    @classmethod
    def generate_csv(cls, optimization_result: Dict[str, Any]) -> str:
        """Exports route alternatives comparison to standard CSV."""
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Route ID", "Route Name", "Algorithm", "Is Recommended", "Distance (km)",
            "Travel Time (Hours)", "Total Cost (INR)", "Fuel Cost (INR)", "Toll Charges (INR)",
            "Risk Score (1-10)", "Multi-Objective Score", "Waypoints"
        ])

        for r in optimization_result.get("ranked_routes", []):
            writer.writerow([
                r.get("route_id"),
                r.get("name"),
                r.get("algorithm"),
                "YES" if r.get("is_recommended") else "NO",
                r.get("distance_km"),
                r.get("travel_time_hours"),
                r.get("total_cost_inr"),
                r.get("cost_breakdown", {}).get("fuel_cost_inr", 0),
                r.get("cost_breakdown", {}).get("toll_charges_inr", 0),
                r.get("risk_score"),
                r.get("multi_objective_score"),
                " -> ".join(r.get("path_names", []))
            ])

        return output.getvalue()


TradeRouteReportGenerator.generate_academic_text_report = TradeRouteReportGenerator.generate_text_summary
TradeRouteReportGenerator.generate_csv_matrix = TradeRouteReportGenerator.generate_csv


