from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=100, pattern="^[a-z0-9-]+$")
    logo_url: Optional[str] = None


class OrganizationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    logo_url: Optional[str] = None
    is_active: Optional[bool] = None


class OrganizationResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    logo_url: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OrgSettingsUpdate(BaseModel):
    theme_config: Optional[dict] = None
    proctoring_defaults: Optional[dict] = None
    max_violation_warnings: Optional[int] = Field(None, ge=1, le=10)
    auto_terminate_on_violations: Optional[bool] = None
    allowed_ai_providers: Optional[list[str]] = None
    assessment_defaults: Optional[dict] = None
    notification_config: Optional[dict] = None


class OrgSettingsResponse(BaseModel):
    id: UUID
    organization_id: UUID
    theme_config: dict
    proctoring_defaults: dict
    max_violation_warnings: int
    auto_terminate_on_violations: bool
    allowed_ai_providers: list
    assessment_defaults: dict
    notification_config: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OrganizationListResponse(BaseModel):
    organizations: list[OrganizationResponse]
    total: int
