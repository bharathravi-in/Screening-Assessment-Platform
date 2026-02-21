from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


# --- Verify ---

class TestVerifyResponse(BaseModel):
    invitation_id: str
    assessment_id: str
    assessment_title: str
    assessment_description: Optional[str] = None
    assessment_instructions: Optional[str] = None
    time_limit_minutes: Optional[int] = None
    total_questions: int
    candidate_name: str
    candidate_email: str
    status: str
    proctoring_enabled: bool = False
    proctoring_config: Optional[dict] = None


# --- Start ---

class TestStartRequest(BaseModel):
    invitation_token: str


class TestQuestionOptionDTO(BaseModel):
    id: str
    label: str
    text: str
    order_index: int

    model_config = {"from_attributes": True}


class TestQuestionCodeStubDTO(BaseModel):
    language: str
    stub_code: str

    model_config = {"from_attributes": True}


class TestQuestionTestCaseDTO(BaseModel):
    id: str
    input: str
    expected_output: str
    order_index: int

    model_config = {"from_attributes": True}


class TestQuestionDTO(BaseModel):
    """Question sent to candidate — no correct answers."""
    id: str
    assessment_question_id: str
    type: str
    difficulty: str
    title: str
    body: str
    time_limit_seconds: Optional[int] = None
    max_score: float
    order_index: int
    weight: float = 1.0
    options: list[TestQuestionOptionDTO] = []
    code_stubs: list[TestQuestionCodeStubDTO] = []
    test_cases: list[TestQuestionTestCaseDTO] = []  # only sample/non-hidden


class TestStartResponse(BaseModel):
    session_id: str
    candidate_token: str
    time_remaining_seconds: Optional[int] = None
    questions: list[TestQuestionDTO]
    proctoring_config: Optional[dict] = None


# --- Session State ---

class SessionStateResponse(BaseModel):
    session_id: str
    status: str
    current_question_index: int
    time_remaining_seconds: Optional[int] = None
    total_questions: int
    answered_count: int
    flagged_count: int
    proctoring_violations: int


# --- Response Save ---

class ResponseSaveRequest(BaseModel):
    selected_option_ids: Optional[list[str]] = None
    text_response: Optional[str] = None
    code_response: Optional[str] = None
    code_language: Optional[str] = None
    time_spent_seconds: int = 0
    is_flagged: bool = False
    code_snapshots: Optional[list[dict]] = None  # [{timestamp, code, language}]


class ResponseSaveResponse(BaseModel):
    response_id: str
    question_id: str
    is_submitted: bool
    saved_at: str


# --- Submit ---

class TestSubmitResponse(BaseModel):
    session_id: str
    status: str
    total_score: Optional[float] = None
    total_max_score: Optional[float] = None
    score_pct: Optional[float] = None
    is_passed: Optional[bool] = None
    show_score: bool = False
    message: str = "Test submitted successfully"


# --- Completion ---

class CompletionResponse(BaseModel):
    session_id: str
    candidate_name: str
    assessment_title: str
    status: str
    total_score: Optional[float] = None
    total_max_score: Optional[float] = None
    score_pct: Optional[float] = None
    is_passed: Optional[bool] = None
    show_score: bool = False
    completed_at: Optional[str] = None


# --- Proctoring ---

class ProctoringViolationRequest(BaseModel):
    violation_type: str
    details: Optional[str] = None
    timestamp: Optional[str] = None


class ProctoringStatusResponse(BaseModel):
    violations: int
    max_violations: int
    warnings_remaining: int
    is_terminated: bool = False


# --- Navigation ---

class NavigationRequest(BaseModel):
    question_index: int
