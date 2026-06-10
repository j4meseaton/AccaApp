import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import get_settings
from app.database import create_tables
from app.routers import assets, auth, integrations, lifecycle, licenses, reports

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s")
logger = logging.getLogger(__name__)
settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("AssetSphere starting up...")
    try:
        await create_tables()
    except Exception as exc:
        logger.error("Database startup error: %s", exc)
    yield
    from app.database import engine
    await engine.dispose()

def create_app() -> FastAPI:
    app = FastAPI(title="AssetSphere", description="Software Asset Management API", version="1.0.0", docs_url="/docs", redoc_url="/redoc", lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=settings.ALLOWED_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
    app.include_router(auth.router, prefix="/api")
    app.include_router(assets.router, prefix="/api")
    app.include_router(licenses.router, prefix="/api")
    app.include_router(lifecycle.router, prefix="/api")
    app.include_router(integrations.router, prefix="/api")
    app.include_router(reports.router, prefix="/api")

    @app.get("/health", tags=["health"])
    async def health_check() -> JSONResponse:
        from sqlalchemy import text
        from app.database import AsyncSessionLocal
        db_status = "ok"
        try:
            async with AsyncSessionLocal() as session:
                await session.execute(text("SELECT 1"))
        except Exception as exc:
            db_status = f"error: {exc}"
        healthy = db_status == "ok"
        return JSONResponse(content={"status": "healthy" if healthy else "unhealthy", "database": db_status}, status_code=200 if healthy else 503)

    return app

app = create_app()
