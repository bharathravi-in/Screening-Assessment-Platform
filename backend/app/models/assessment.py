import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class AssessmentStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ACTIVE = "active"
    CLOSED = "closed"
    ARCHIVED = "archived"


class Assessment(TimestampMixin, Base):
    __tablename__ = "assessments"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[AssessmentStatus] = mapped_column(
        String(20), nullable=False, default=AssessmentStatus.DRAFT.value
    )
    time_limit_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    passing_score_pct: Mapped[float] = mapped_column(Float, default=50.0)
    max_attempts: Mapped[int] = mapped_column(Integer, default=1)
    is_randomized: Mapped[bool] = mapped_column(Boolean, default=False)
    is_adaptive: Mapped[bool] = mapped_column(Boolean, default=False)
    show_score_immediately: Mapped[bool] = mapped_column(Boolean, default=True)
    proctoring_config: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    scheduled_start: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    scheduled_end: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    organization = relationship("Organization")
    created_by = relationship("User")
    sections = relationship(
        "AssessmentSection", back_populates="assessment", cascade="all, delete-orphan",
        order_by="AssessmentSection.order_index"
    )
    assessment_questions = relationship(
        "AssessmentQuestion", back_populates="assessment", cascade="all, delete-orphan",
        order_by="AssessmentQuestion.order_index"
    )


class AssessmentSection(TimestampMixin, Base):
    __tablename__ = "assessment_sections"

    assessment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    time_limit_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Relationships
    assessment = relationship("Assessment", back_populates="sections")
    questions = relationship("AssessmentQuestion", back_populates="section")


class AssessmentQuestion(TimestampMixin, Base):
    __tablename__ = "assessment_questions"
    __table_args__ = (
        UniqueConstraint("assessment_id", "question_id", name="uq_assessment_question"),
    )

    assessment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False
    )
    section_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assessment_sections.id", ondelete="SET NULL"), nullable=True
    )
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    is_required: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    assessment = relationship("Assessment", back_populates="assessment_questions")
    question = relationship("Question")
    section = relationship("AssessmentSection", back_populates="questions")
