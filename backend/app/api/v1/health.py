from fastapi import APIRouter
from sqlalchemy import text

from app.db.session import async_session_factory

router = APIRouter()


@router.get("/")
async def health_check():
    return {"status": "healthy", "service": "assessment-platform"}


@router.get("/detailed")
async def detailed_health_check():
    checks = {"api": "healthy", "database": "unknown"}

    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
            checks["database"] = "healthy"
    except Exception as e:
        checks["database"] = f"unhealthy: {str(e)}"

    overall = "healthy" if all(v == "healthy" for v in checks.values()) else "degraded"
    return {"status": overall, "checks": checks}
