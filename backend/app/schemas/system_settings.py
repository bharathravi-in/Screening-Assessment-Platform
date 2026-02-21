from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class SystemSettingsResponse(BaseModel):
    id: UUID
    created_at: datetime
    updated_at: datetime
    # AI
    ai_providers_config: dict
    default_ai_provider: str
    # Platform
    maintenance_mode: bool
    maintenance_message: Optional[str]
    allow_org_self_registration: bool
    max_orgs: int
    max_users_per_org: int
    max_assessments_per_org: int
    max_candidates_per_assessment: int
    # Security
    access_token_expire_minutes: int
    refresh_token_expire_days: int
    password_min_length: int
    password_require_uppercase: bool
    password_require_numbers: bool
    password_require_special: bool
    max_login_attempts: int
    lockout_duration_minutes: int
    # Email
    smtp_host: Optional[str]
    smtp_port: int
    smtp_username: Optional[str]
    smtp_password: Optional[str]
    smtp_from_address: Optional[str]
    smtp_from_name: str
    smtp_use_tls: bool
    # Rate Limiting
    api_rate_limit_per_minute: int
    candidate_rate_limit_per_minute: int

    model_config = {"from_attributes": True}


class SystemSettingsUpdate(BaseModel):
    # AI
    ai_providers_config: Optional[dict] = None
    default_ai_provider: Optional[str] = None
    # Platform
    maintenance_mode: Optional[bool] = None
    maintenance_message: Optional[str] = None
    allow_org_self_registration: Optional[bool] = None
    max_orgs: Optional[int] = None
    max_users_per_org: Optional[int] = None
    max_assessments_per_org: Optional[int] = None
    max_candidates_per_assessment: Optional[int] = None
    # Security
    access_token_expire_minutes: Optional[int] = None
    refresh_token_expire_days: Optional[int] = None
    password_min_length: Optional[int] = None
    password_require_uppercase: Optional[bool] = None
    password_require_numbers: Optional[bool] = None
    password_require_special: Optional[bool] = None
    max_login_attempts: Optional[int] = None
    lockout_duration_minutes: Optional[int] = None
    # Email
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_address: Optional[str] = None
    smtp_from_name: Optional[str] = None
    smtp_use_tls: Optional[bool] = None
    # Rate Limiting
    api_rate_limit_per_minute: Optional[int] = None
    candidate_rate_limit_per_minute: Optional[int] = None

