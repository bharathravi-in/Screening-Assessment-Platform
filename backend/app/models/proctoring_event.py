"""Proctoring event models for advanced anti-cheating system."""

import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class EventSeverity(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class EventType(str, enum.Enum):
    TAB_SWITCH = "tab_switch"
    WINDOW_BLUR = "window_blur"
    FULLSCREEN_EXIT = "fullscreen_exit"
    COPY_ATTEMPT = "copy_attempt"
    PASTE_ATTEMPT = "paste_attempt"
    RIGHT_CLICK = "right_click"
    DEV_TOOLS = "dev_tools"
    SCREENSHOT = "screenshot"
    AUDIO_ANOMALY = "audio_anomaly"
    WEBCAM_FACE_MISSING = "webcam_face_missing"
    WEBCAM_MULTI_FACE = "webcam_multi_face"
    IP_CHANGE = "ip_change"
    IDLE_TIMEOUT = "idle_timeout"


class ProctoringEvent(TimestampMixin, Base):
    """Individual proctoring event recorded during a test session."""
    __tablename__ = "proctoring_events"
    __table_args__ = (
        Index("ix_proctoring_events_session_id", "session_id"),
        Index("ix_proctoring_events_session_type", "session_id", "event_type"),
    )

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("candidate_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[str] = mapped_column(
        String(20), nullable=False, default=EventSeverity.WARNING.value
    )
    details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, nullable=True)
    client_timestamp: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)

    # Relationships
    session = relationship("CandidateSession")


class ProctoringSnapshot(TimestampMixin, Base):
    """Periodic webcam snapshot captured during a test session."""
    __tablename__ = "proctoring_snapshots"
    __table_args__ = (
        Index("ix_proctoring_snapshots_session_id", "session_id"),
    )

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("candidate_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    image_data: Mapped[str] = mapped_column(Text, nullable=False)  # base64
    face_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    anomaly_flags: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    captured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Relationships
    session = relationship("CandidateSession")


class IdentityVerification(TimestampMixin, Base):
    """Pre-test identity verification record."""
    __tablename__ = "identity_verifications"
    __table_args__ = (
        Index("ix_identity_verifications_session_id", "session_id"),
    )

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("candidate_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    selfie_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # base64
    id_document_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # base64
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    verification_method: Mapped[str] = mapped_column(
        String(50), default="manual", nullable=False
    )
    reviewer_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    session = relationship("CandidateSession")


class PlagiarismReport(TimestampMixin, Base):
    """AI-generated plagiarism/LLM detection report for a response."""
    __tablename__ = "plagiarism_reports"
    __table_args__ = (
        Index("ix_plagiarism_reports_session_id", "session_id"),
        Index("ix_plagiarism_reports_response_id", "response_id"),
    )

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("candidate_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    response_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("candidate_responses.id", ondelete="CASCADE"),
        nullable=False,
    )
    plagiarism_score: Mapped[float] = mapped_column(Float, default=0.0)
    llm_probability: Mapped[float] = mapped_column(Float, default=0.0)
    findings: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    flagged_segments: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    analysis_details: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    session = relationship("CandidateSession")
    response = relationship("CandidateResponse")
