import os
import sqlite3


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "data", "supplyguard.db")


def get_connection() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON;")
    return connection


def init_db() -> None:
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('planner', 'analyst')),
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS routes (
                route_id INTEGER PRIMARY KEY AUTOINCREMENT,
                origin TEXT NOT NULL,
                destination TEXT NOT NULL,
                created_by INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
                FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE RESTRICT
            );

            CREATE TABLE IF NOT EXISTS route_variants (
                variant_id INTEGER PRIMARY KEY AUTOINCREMENT,
                route_id INTEGER NOT NULL,
                mode TEXT NOT NULL CHECK (mode IN ('sea', 'air', 'road')),
                path_name TEXT NOT NULL,
                feasibility TEXT NOT NULL CHECK (feasibility IN ('yes', 'limited', 'no')),
                FOREIGN KEY (route_id) REFERENCES routes(route_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS risk_assessment (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                variant_id INTEGER NOT NULL,
                total_risk_score REAL NOT NULL,
                primary_risk TEXT NOT NULL CHECK (primary_risk IN ('fuel', 'geopolitics', 'weather')),
                confidence REAL NOT NULL,
                calculated_at TEXT NOT NULL,
                FOREIGN KEY (variant_id) REFERENCES route_variants(variant_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS cost_time_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                variant_id INTEGER NOT NULL,
                cost_index TEXT NOT NULL CHECK (cost_index IN ('$', '$$', '$$$', '$$$$')),
                estimated_cost REAL NOT NULL,
                transit_days INTEGER NOT NULL,
                reliability_score REAL NOT NULL,
                FOREIGN KEY (variant_id) REFERENCES route_variants(variant_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS ai_recommendation (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                route_id INTEGER NOT NULL,
                recommended_variant_id INTEGER NOT NULL,
                reasoning TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (route_id) REFERENCES routes(route_id) ON DELETE CASCADE,
                FOREIGN KEY (recommended_variant_id) REFERENCES route_variants(variant_id) ON DELETE RESTRICT
            );

            CREATE TABLE IF NOT EXISTS reports (
                report_id INTEGER PRIMARY KEY AUTOINCREMENT,
                route_id INTEGER NOT NULL,
                report_type TEXT NOT NULL,
                generated_by TEXT NOT NULL,
                generated_at TEXT NOT NULL,
                file_path TEXT NOT NULL,
                FOREIGN KEY (route_id) REFERENCES routes(route_id) ON DELETE RESTRICT
            );

            CREATE INDEX IF NOT EXISTS idx_routes_created_by ON routes(created_by);
            CREATE INDEX IF NOT EXISTS idx_route_variants_route_id ON route_variants(route_id);
            CREATE INDEX IF NOT EXISTS idx_risk_assessment_variant_id ON risk_assessment(variant_id);
            CREATE INDEX IF NOT EXISTS idx_cost_time_metrics_variant_id ON cost_time_metrics(variant_id);
            CREATE INDEX IF NOT EXISTS idx_ai_recommendation_route_id ON ai_recommendation(route_id);
            CREATE INDEX IF NOT EXISTS idx_ai_recommendation_variant_id ON ai_recommendation(recommended_variant_id);
            CREATE INDEX IF NOT EXISTS idx_reports_route_id ON reports(route_id);
            """
        )
        connection.commit()
    finally:
        connection.close()


if __name__ == "__main__":
    init_db()

