from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class QuestionOptionCreate(BaseModel):
    label: str
    text: str
    is_correct: bool
    order_index: int = 0


class QuestionOptionResponse(BaseModel):
    id: UUID
    label: str
    text: str
    is_correct: bool
    order_index: int

    model_config = {"from_attributes": True}


class QuestionTestCaseCreate(BaseModel):
    input: str
    expected_output: str
    is_hidden: bool = False
    is_sample: bool = False
    order_index: int = 0
    time_limit_ms: int = 5000
    memory_limit_mb: int = 256


class QuestionTestCaseResponse(BaseModel):
    id: UUID
    input: str
    expected_output: str
    is_hidden: bool
    is_sample: bool
    order_index: int
    time_limit_ms: int
    memory_limit_mb: int

    model_config = {"from_attributes": True}


class QuestionCodeStubCreate(BaseModel):
    language: str
    stub_code: str
    solution_code: Optional[str] = None


class QuestionCodeStubResponse(BaseModel):
    id: UUID
    language: str
    stub_code: str
    solution_code: Optional[str]

    model_config = {"from_attributes": True}


class QuestionTagResponse(BaseModel):
    skill_id: UUID

    model_config = {"from_attributes": True}


class QuestionCreate(BaseModel):
    type: str = Field(
        pattern="^(mcq|multi_select|short_answer|debugging|code_completion|coding|system_design|scenario)$"
    )
    difficulty: str = Field(
        pattern="^(beginner|intermediate|advanced|expert)$"
    )
    title: str = Field(min_length=1, max_length=500)
    body: str = Field(min_length=1)
    explanation: Optional[str] = None
    time_limit_seconds: Optional[int] = None
    max_score: float = 10.0
    options: Optional[list[QuestionOptionCreate]] = None
    test_cases: Optional[list[QuestionTestCaseCreate]] = None
    code_stubs: Optional[list[QuestionCodeStubCreate]] = None
    skill_ids: Optional[list[UUID]] = None


class QuestionUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    body: Optional[str] = Field(None, min_length=1)
    explanation: Optional[str] = None
    difficulty: Optional[str] = Field(
        None, pattern="^(beginner|intermediate|advanced|expert)$"
    )
    time_limit_seconds: Optional[int] = None
    max_score: Optional[float] = None
    is_active: Optional[bool] = None


class QuestionResponse(BaseModel):
    id: UUID
    organization_id: Optional[UUID]
    created_by_id: Optional[UUID]
    type: str
    difficulty: str
    title: str
    body: str
    explanation: Optional[str]
    time_limit_seconds: Optional[int]
    max_score: float
    is_ai_generated: bool
    is_active: bool
    usage_count: int
    avg_score_pct: Optional[float]
    created_at: datetime
    updated_at: datetime
    options: list[QuestionOptionResponse] = []
    test_cases: list[QuestionTestCaseResponse] = []
    code_stubs: list[QuestionCodeStubResponse] = []
    tags: list[QuestionTagResponse] = []

    model_config = {"from_attributes": True}


class QuestionListResponse(BaseModel):
    questions: list[QuestionResponse]
    total: int
    page: int
    page_size: int
