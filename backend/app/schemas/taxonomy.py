from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class TechnologyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    category: str = Field(
        pattern="^(language|framework|database|cloud|tool|concept|other)$"
    )
    icon_url: Optional[str] = None


class TechnologyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    category: Optional[str] = Field(
        None, pattern="^(language|framework|database|cloud|tool|concept|other)$"
    )
    is_active: Optional[bool] = None
    icon_url: Optional[str] = None


class TechnologyResponse(BaseModel):
    id: UUID
    name: str
    category: str
    icon_url: Optional[str]
    is_active: bool
    organization_id: Optional[UUID] = None  # None = global master
    created_at: datetime
    updated_at: datetime

    @property
    def is_global(self) -> bool:
        return self.organization_id is None

    model_config = {"from_attributes": True}


class SkillCreate(BaseModel):
    technology_id: UUID
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    difficulty_default: Optional[str] = Field(
        None, pattern="^(beginner|intermediate|advanced|expert)$"
    )


class SkillUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    difficulty_default: Optional[str] = Field(
        None, pattern="^(beginner|intermediate|advanced|expert)$"
    )
    is_active: Optional[bool] = None


class SkillResponse(BaseModel):
    id: UUID
    technology_id: UUID
    name: str
    description: Optional[str]
    difficulty_default: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TechnologyWithSkillsResponse(TechnologyResponse):
    skills: list[SkillResponse] = []


class DifficultyLevelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    numeric_value: int = Field(ge=1, le=10)
    description: Optional[str] = None
    time_multiplier: float = 1.0
    organization_id: Optional[UUID] = None


class DifficultyLevelResponse(BaseModel):
    id: UUID
    name: str
    numeric_value: int
    description: Optional[str]
    time_multiplier: float
    organization_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
