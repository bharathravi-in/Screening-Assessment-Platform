import copy

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_roles
from app.db.session import get_db
from app.models.system_settings import SystemSettings
from app.models.user import User
from app.schemas.system_settings import SystemSettingsResponse, SystemSettingsUpdate

router = APIRouter()

_MASKED = "••••••••"


def _mask(settings: SystemSettings) -> dict:
    """Return a dict with the SMTP password masked."""
    data = SystemSettingsResponse.model_validate(settings).model_dump()
    if data.get("smtp_password"):
        data["smtp_password"] = _MASKED
    return data


async def _get_singleton(db: AsyncSession) -> SystemSettings:
    result = await db.execute(select(SystemSettings))
    row = result.scalar_one_or_none()
    if not row:
        # Auto-create on first access
        row = SystemSettings()
        db.add(row)
        await db.flush()
        await db.refresh(row)
    return row


@router.get("/", response_model=dict)
async def get_system_settings(
    current_user: User = Depends(require_roles("super_admin")),
    db: AsyncSession = Depends(get_db),
):
    settings = await _get_singleton(db)
    return _mask(settings)


@router.put("/", response_model=dict)
async def update_system_settings(
    request: SystemSettingsUpdate,
    current_user: User = Depends(require_roles("super_admin")),
    db: AsyncSession = Depends(get_db),
):
    settings = await _get_singleton(db)
    update_data = request.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        # If caller sends the masked placeholder for smtp_password, skip it
        if field == "smtp_password" and value == _MASKED:
            continue
        # Deep-merge JSONB dicts (ai_providers_config) instead of overwriting
        if field == "ai_providers_config" and isinstance(value, dict):
            merged = copy.deepcopy(getattr(settings, field) or {})
            for provider, cfg in value.items():
                if provider in merged:
                    merged[provider].update(cfg)
                else:
                    merged[provider] = cfg
            setattr(settings, field, merged)
        else:
            setattr(settings, field, value)

    await db.flush()
    await db.refresh(settings)
    return _mask(settings)
