from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.question import QuestionResponse


class AssessmentSectionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    order_index: int = 0
    time_limit_minutes: Optional[int] = None


class AssessmentSectionUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    order_index: Optional[int] = None
    time_limit_minutes: Optional[int] = None


class AssessmentSectionResponse(BaseModel):
    id: UUID
    title: str
    description: Optional[str]
    order_index: int
    time_limit_minutes: Optional[int]

    model_config = {"from_attributes": True}


class AssessmentQuestionAdd(BaseModel):
    question_id: UUID
    section_id: Optional[UUID] = None
    order_index: int = 0
    weight: float = 1.0
    is_required: bool = True


class AssessmentQuestionUpdate(BaseModel):
    section_id: Optional[UUID] = None
    order_index: Optional[int] = None
    weight: Optional[float] = None
    is_required: Optional[bool] = None


class AssessmentQuestionResponse(BaseModel):
    id: UUID
    question_id: UUID
    section_id: Optional[UUID]
    order_index: int
    weight: float
    is_required: bool
    question: QuestionResponse

    model_config = {"from_attributes": True}


class ReorderItem(BaseModel):
    id: UUID
    order_index: int


class AssessmentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    description: Optional[str] = None
    instructions: Optional[str] = None
    time_limit_minutes: Optional[int] = None
    passing_score_pct: float = 50.0
    max_attempts: int = 1
    is_randomized: bool = False
    is_adaptive: bool = False
    show_score_immediately: bool = True
    proctoring_config: Optional[dict] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None


class AssessmentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    instructions: Optional[str] = None
    time_limit_minutes: Optional[int] = None
    passing_score_pct: Optional[float] = None
    max_attempts: Optional[int] = None
    is_randomized: Optional[bool] = None
    is_adaptive: Optional[bool] = None
    show_score_immediately: Optional[bool] = None
    proctoring_config: Optional[dict] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None


class AssessmentResponse(BaseModel):
    id: UUID
    organization_id: UUID
    created_by_id: UUID
    title: str
    description: Optional[str]
    instructions: Optional[str]
    status: str
    time_limit_minutes: Optional[int]
    passing_score_pct: float
    max_attempts: int
    is_randomized: bool
    is_adaptive: bool
    show_score_immediately: bool
    proctoring_config: Optional[dict]
    scheduled_start: Optional[datetime]
    scheduled_end: Optional[datetime]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AssessmentDetailResponse(AssessmentResponse):
    sections: list[AssessmentSectionResponse] = []
    assessment_questions: list[AssessmentQuestionResponse] = []


class AssessmentListResponse(BaseModel):
    assessments: list[AssessmentResponse]
    total: int
    page: int
    page_size: int
