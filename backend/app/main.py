"""
Hall Management Portal — FastAPI application entry point.

Run with:
    uvicorn app.main:app --reload --port 8000
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, bookings, dashboard, hall_office, items, menu, staff, worker, notices
from app.services.scheduler import start_scheduler, stop_scheduler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start APScheduler on startup, stop on shutdown."""
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="Hall 12 — Marathas Portal",
    description="Hall Management Portal for IIT Kanpur Hall of Residence XII",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — restricted to the frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[url.strip() for url in settings.FRONTEND_URL.split(",") if url.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(menu.router)
app.include_router(items.router)
app.include_router(bookings.router)
app.include_router(staff.router)
app.include_router(worker.router)
app.include_router(hall_office.router)
app.include_router(notices.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Hall 12 Marathas Portal"}
