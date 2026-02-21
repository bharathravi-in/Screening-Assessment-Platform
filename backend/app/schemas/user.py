from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class UserBase(BaseModel):
    email: str = Field(max_length=255)
    full_name: str = Field(min_length=1, max_length=255)
    role: str = Field(pattern="^(super_admin|admin|hr|tech)$")
    organization_id: Optional[UUID] = None


class UserCreate(UserBase):
    password: str = Field(min_length=6, max_length=128)
    allowed_skill_ids: Optional[list] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    is_active: Optional[bool] = None
    organization_id: Optional[UUID] = None


class UserRoleUpdate(BaseModel):
    role: str = Field(pattern="^(super_admin|admin|hr|tech)$")
    allowed_skill_ids: Optional[list] = None


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: str
    organization_id: Optional[UUID]
    is_active: bool
    last_login_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    allowed_skill_ids: Optional[list] = None

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    users: list[UserResponse]
    total: int
    page: int
    page_size: int
