import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.init_db import init_db
from app.api.v1 import api_v1_router
from app.api.legacy_router import router as legacy_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="HETVAYA FlowGrid: AI-Powered FMCG Distribution Intelligence, Expiry-Aware Inventory Optimization, and Constrained Dispatch.",
    lifespan=lifespan
)

# Enable CORS for dashboard and local clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include v1 REST API & Legacy Dashboard Routers
app.include_router(api_v1_router)
app.include_router(legacy_router)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DASHBOARD_DIR = os.path.join(BASE_DIR, "dashboard")
SRC_DIR = os.path.join(BASE_DIR, "src")
ASSETS_DIR = os.path.join(BASE_DIR, "assets")

# Mount static folders if present
if os.path.exists(SRC_DIR):
    app.mount("/src", StaticFiles(directory=SRC_DIR), name="src")
if os.path.exists(ASSETS_DIR):
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")


@app.get("/health")
def health_check():
    return {
        "status": "HEALTHY",
        "system": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "mode": "FMCG_DISTRIBUTION_INTELLIGENCE"
    }


# Dashboard Web Pages Routing
@app.get("/")
def serve_index():
    path = os.path.join(DASHBOARD_DIR, "index.html")
    if os.path.exists(path):
        return FileResponse(path)
    return {"message": "HETVAYA FlowGrid API Running. Explore /docs for Interactive Swagger UI."}


@app.get("/dashboard")
def serve_dashboard():
    path = os.path.join(DASHBOARD_DIR, "dashboard.html")
    if os.path.exists(path):
        return FileResponse(path)
    return FileResponse(os.path.join(DASHBOARD_DIR, "index.html"))


@app.get("/plan-generator")
def serve_plan_generator():
    return RedirectResponse(url="/trade-routes", status_code=302)


@app.get("/inventory-health")
def serve_inventory_health():
    return RedirectResponse(url="/trade-routes", status_code=302)


@app.get("/kirana-pos")
def serve_kirana_pos():
    return RedirectResponse(url="/trade-routes", status_code=302)


@app.get("/road-risk")
def serve_road_risk():
    return RedirectResponse(url="/trade-routes", status_code=302)


@app.get("/import-studio")
def serve_import_studio():
    return RedirectResponse(url="/trade-routes", status_code=302)


# Generic Dashboard Page Handler (supports /routes, /analysis, /reports, /map, etc.)
@app.get("/{page_name}")
def serve_page(page_name: str):
    target = page_name if page_name.endswith(".html") else f"{page_name}.html"
    path = os.path.join(DASHBOARD_DIR, target)
    if os.path.exists(path):
        return FileResponse(path)
    raise HTTPException(status_code=404, detail=f"Page '{page_name}' not found")
