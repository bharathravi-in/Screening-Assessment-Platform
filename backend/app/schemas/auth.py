from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str = Field(max_length=255)
    password: str = Field(min_length=6, max_length=128)


class RegisterRequest(BaseModel):
    email: str = Field(max_length=255)
    password: str = Field(min_length=6, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    role: str = Field(default="hr", pattern="^(super_admin|admin|hr|tech)$")
    organization_id: Optional[UUID] = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str
    user_id: UUID
    full_name: str
    organization_id: Optional[UUID] = None


class RefreshRequest(BaseModel):
    refresh_token: str


class CandidateVerifyRequest(BaseModel):
    token: str
