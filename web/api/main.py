"""FastAPI application entry point for the AML fraud-detection backend.

Run with::

    uvicorn web.api.main:app --reload --port 8000

The pipeline modules are NOT imported at startup. They are pulled in lazily
inside the background job runner so cold-starts stay fast even when sklearn is
slow to load.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from web.api import ensure_dirs
from web.api.routers import alerts, dashboard, graph, models, runs, transactions
from web.api.storage import init_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("web.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create data directories and the SQLite schema on startup."""
    ensure_dirs()
    init_db()
    logger.info("AML API ready")
    yield


def create_app() -> FastAPI:
    """Application factory so tests / scripts can spin up fresh instances."""
    app = FastAPI(
        title="MacroBase AML Detection API",
        description=(
            "HTTP wrapper around the MacroBase-style AML pipeline. "
            "Upload a CSV to score transactions, inspect alerts, and "
            "explore the transaction graph."
        ),
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:5174",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    # Register routers under the /api prefix.
    app.include_router(runs.router, prefix="/api")
    app.include_router(models.router, prefix="/api")
    app.include_router(transactions.router, prefix="/api")
    app.include_router(alerts.router, prefix="/api")
    app.include_router(dashboard.router, prefix="/api")
    app.include_router(graph.router, prefix="/api")

    return app


app = create_app()
