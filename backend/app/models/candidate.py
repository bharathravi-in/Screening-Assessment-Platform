import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class InvitationStatus(str, enum.Enum):
    PENDING = "pending"
    SENT = "sent"
    OPENED = "opened"
    STARTED = "started"
    COMPLETED = "completed"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class SessionStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    TERMINATED = "terminated"
    TIMED_OUT = "timed_out"


class CandidateInvitation(TimestampMixin, Base):
    __tablename__ = "candidate_invitations"
    __table_args__ = (
        UniqueConstraint("assessment_id", "candidate_email", name="uq_assessment_candidate"),
    )

    assessment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False
    )
    invited_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    candidate_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    candidate_name: Mapped[str] = mapped_column(String(255), nullable=False)
    token: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=InvitationStatus.PENDING.value
    )
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    opened_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)

    # Relationships
    assessment = relationship("Assessment")
    organization = relationship("Organization")
    invited_by = relationship("User")
    sessions = relationship("CandidateSession", back_populates="invitation")


class CandidateSession(TimestampMixin, Base):
    __tablename__ = "candidate_sessions"
    __table_args__ = (
        Index("ix_candidate_sessions_assessment_id", "assessment_id"),
        Index("ix_candidate_sessions_organization_id", "organization_id"),
        Index("ix_candidate_sessions_status", "status"),
        Index("ix_candidate_sessions_org_status", "organization_id", "status"),
    )

    assessment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False
    )
    invitation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("candidate_invitations.id", ondelete="CASCADE"), nullable=False
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False
    )
    candidate_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    candidate_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=SessionStatus.NOT_STARTED.value
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    time_remaining_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    current_question_index: Mapped[int] = mapped_column(Integer, default=0)
    total_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    total_max_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    score_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_passed: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    proctoring_violations: Mapped[int] = mapped_column(Integer, default=0)
    proctoring_log: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    skill_scores: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    adaptive_state: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Relationships
    assessment = relationship("Assessment")
    invitation = relationship("CandidateInvitation", back_populates="sessions")
    organization = relationship("Organization")
    responses = relationship("CandidateResponse", back_populates="session", cascade="all, delete-orphan")
