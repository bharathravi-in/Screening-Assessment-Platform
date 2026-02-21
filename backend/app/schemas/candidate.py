from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class InviteRequest(BaseModel):
    assessment_id: UUID
    candidate_email: EmailStr
    candidate_name: str = Field(min_length=1, max_length=255)
    expires_at: Optional[datetime] = None


class BulkInviteRequest(BaseModel):
    assessment_id: UUID
    candidates: list[InviteRequest]


class InvitationUpdate(BaseModel):
    status: Optional[str] = None
    expires_at: Optional[datetime] = None


class InvitationResponse(BaseModel):
    id: UUID
    assessment_id: UUID
    organization_id: UUID
    invited_by_id: UUID
    candidate_email: str
    candidate_name: str
    token: str
    status: str
    sent_at: Optional[datetime]
    opened_at: Optional[datetime]
    expires_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InvitationListResponse(BaseModel):
    invitations: list[InvitationResponse]
    total: int
    page: int
    page_size: int


class CandidateResponseSummary(BaseModel):
    id: UUID
    question_id: UUID
    is_submitted: bool
    time_spent_seconds: int
    final_score: Optional[float]
    max_score: Optional[float]

    model_config = {"from_attributes": True}


class SessionResponse(BaseModel):
    id: UUID
    assessment_id: UUID
    invitation_id: UUID
    organization_id: UUID
    candidate_email: str
    candidate_name: str
    status: str
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    time_remaining_seconds: Optional[int]
    current_question_index: int
    total_score: Optional[float]
    total_max_score: Optional[float]
    score_pct: Optional[float]
    is_passed: Optional[bool]
    proctoring_violations: int
    ip_address: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SessionDetailResponse(SessionResponse):
    responses: list[CandidateResponseSummary] = []
    proctoring_log: Optional[list] = None


class SessionListResponse(BaseModel):
    sessions: list[SessionResponse]
    total: int
    page: int
    page_size: int
