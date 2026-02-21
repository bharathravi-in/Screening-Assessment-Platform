import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class CandidateResponse(TimestampMixin, Base):
    __tablename__ = "candidate_responses"
    __table_args__ = (
        Index("ix_candidate_responses_session_id", "session_id"),
        Index("ix_candidate_responses_question_id", "question_id"),
        Index("ix_candidate_responses_session_question", "session_id", "question_id"),
    )

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("candidate_sessions.id", ondelete="CASCADE"), nullable=False
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False
    )
    assessment_question_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assessment_questions.id", ondelete="SET NULL"), nullable=True
    )
    selected_option_ids: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    text_response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    code_response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    code_language: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    is_submitted: Mapped[bool] = mapped_column(Boolean, default=False)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    time_spent_seconds: Mapped[int] = mapped_column(Integer, default=0)
    auto_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ai_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    final_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    max_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    evaluation_feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evaluation_metadata: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    code_execution_results: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    code_snapshots: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    # Relationships
    session = relationship("CandidateSession", back_populates="responses")
    question = relationship("Question")
    assessment_question = relationship("AssessmentQuestion")
