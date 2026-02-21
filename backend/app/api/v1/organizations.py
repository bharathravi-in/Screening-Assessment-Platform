from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import is_super_admin, require_roles, same_org
from app.db.session import get_db
from app.models.organization import OrgSettings, Organization
from app.models.user import User
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationListResponse,
    OrganizationResponse,
    OrganizationUpdate,
    OrgSettingsResponse,
    OrgSettingsUpdate,
)

router = APIRouter()


@router.get("/", response_model=OrganizationListResponse)
async def list_organizations(
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    if is_super_admin(current_user):
        # super_admin sees all organizations
        result = await db.execute(select(Organization).order_by(Organization.created_at.desc()))
        orgs = result.scalars().all()
    else:
        # admin/hr/tech see only their own org
        if not current_user.organization_id:
            return OrganizationListResponse(organizations=[], total=0)
        result = await db.execute(
            select(Organization).where(Organization.id == current_user.organization_id)
        )
        orgs = result.scalars().all()

    return OrganizationListResponse(
        organizations=[OrganizationResponse.model_validate(o) for o in orgs],
        total=len(orgs),
    )


@router.post("/", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    request: OrganizationCreate,
    current_user: User = Depends(require_roles("super_admin")),
    db: AsyncSession = Depends(get_db),
):
    # Check slug uniqueness
    result = await db.execute(select(Organization).where(Organization.slug == request.slug))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Organization slug already taken")

    org = Organization(
        name=request.name,
        slug=request.slug,
        logo_url=request.logo_url,
    )
    db.add(org)
    await db.flush()

    # Create default settings
    org_settings = OrgSettings(organization_id=org.id)
    db.add(org_settings)
    await db.flush()
    await db.refresh(org)

    return OrganizationResponse.model_validate(org)


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: UUID,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if not same_org(current_user, org_id):
        raise HTTPException(status_code=403, detail="Access denied")
    return OrganizationResponse.model_validate(org)


@router.put("/{org_id}", response_model=OrganizationResponse)
async def update_organization(
    org_id: UUID,
    request: OrganizationUpdate,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if not same_org(current_user, org_id):
        raise HTTPException(status_code=403, detail="Cannot modify another organization")

    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(org, field, value)

    await db.flush()
    await db.refresh(org)

    return OrganizationResponse.model_validate(org)


@router.get("/{org_id}/settings", response_model=OrgSettingsResponse)
async def get_org_settings(
    org_id: UUID,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    if not same_org(current_user, org_id):
        raise HTTPException(status_code=403, detail="Access denied")
    result = await db.execute(
        select(OrgSettings).where(OrgSettings.organization_id == org_id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        raise HTTPException(status_code=404, detail="Organization settings not found")

    return OrgSettingsResponse.model_validate(settings)


@router.put("/{org_id}/settings", response_model=OrgSettingsResponse)
async def update_org_settings(
    org_id: UUID,
    request: OrgSettingsUpdate,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    if not same_org(current_user, org_id):
        raise HTTPException(status_code=403, detail="Cannot modify another organization's settings")
    result = await db.execute(
        select(OrgSettings).where(OrgSettings.organization_id == org_id)
    )
    settings = result.scalar_one_or_none()

    if not settings:
        raise HTTPException(status_code=404, detail="Organization settings not found")

    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)

    await db.flush()
    await db.refresh(settings)

    return OrgSettingsResponse.model_validate(settings)


@router.get("/branding/{org_slug}")
async def get_public_branding(
    org_slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint — returns the org theme + logo for candidate-facing pages."""
    result = await db.execute(
        select(Organization).where(Organization.slug == org_slug, Organization.is_active == True)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    settings_result = await db.execute(
        select(OrgSettings).where(OrgSettings.organization_id == org.id)
    )
    settings = settings_result.scalar_one_or_none()

    theme = settings.theme_config if settings else {}
    return {
        "organization_name": org.name,
        "logo_url": org.logo_url,
        "theme": theme,
    }
