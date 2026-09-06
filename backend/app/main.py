from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.database.session import SessionLocal
from app.database.init_db import init_db
from app.workers.scheduler import start_monitoring_scheduler, stop_monitoring_scheduler

# Routers
from app.api.v1.auth import router as auth_router
from app.api.v1.devices import router as devices_router
from app.api.v1.monitoring import router as monitoring_router
from app.api.v1.diagnostics import router as diagnostics_router
from app.api.v1.alerts import router as alerts_router
from app.api.v1.incidents import router as incidents_router
from app.api.v1.topology import router as topology_router
from app.api.v1.audit import router as audit_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    setup_logging()
    logger.info("Initializing NetOpsWatch Backend & Database...")
    db = SessionLocal()
    try:
        init_db(db)
    finally:
        db.close()

    # Start non-blocking background monitoring scheduler
    start_monitoring_scheduler()
    logger.info("NetOpsWatch monitoring engine is fully armed and active.")

    yield

    # Shutdown
    logger.info("Shutting down NetOpsWatch monitoring engine...")
    stop_monitoring_scheduler()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Enterprise Network Operations Center (NOC) Monitoring & Troubleshooting Platform",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permits local development on any port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
api_v1_prefix = settings.API_V1_STR
app.include_router(auth_router, prefix=api_v1_prefix)
app.include_router(devices_router, prefix=api_v1_prefix)
app.include_router(monitoring_router, prefix=api_v1_prefix)
app.include_router(diagnostics_router, prefix=api_v1_prefix)
app.include_router(alerts_router, prefix=api_v1_prefix)
app.include_router(incidents_router, prefix=api_v1_prefix)
app.include_router(topology_router, prefix=api_v1_prefix)
app.include_router(audit_router, prefix=api_v1_prefix)

@app.get("/")
def root():
    return {
        "system": settings.PROJECT_NAME,
        "status": "OPERATIONAL",
        "docs_url": "/docs",
        "api_v1": settings.API_V1_STR
    }

@app.get(f"{settings.API_V1_STR}/health")
def health_check():
    return {
        "status": "HEALTHY",
        "version": "1.0.0",
        "monitoring": "ACTIVE"
    }
