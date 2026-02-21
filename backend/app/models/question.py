import enum
import uuid
from typing import Optional

from sqlalchemy import Boolean, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class QuestionType(str, enum.Enum):
    MCQ = "mcq"
    MULTI_SELECT = "multi_select"
    SHORT_ANSWER = "short_answer"
    DEBUGGING = "debugging"
    CODE_COMPLETION = "code_completion"
    CODING = "coding"
    SYSTEM_DESIGN = "system_design"
    SCENARIO = "scenario"


class DifficultyLevel(str, enum.Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


class Question(TimestampMixin, Base):
    __tablename__ = "questions"

    organization_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True
    )
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    type: Mapped[QuestionType] = mapped_column(Enum(QuestionType), nullable=False)
    difficulty: Mapped[DifficultyLevel] = mapped_column(Enum(DifficultyLevel), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    time_limit_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    max_score: Mapped[float] = mapped_column(Float, default=10.0)
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_generation_metadata: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_score_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Relationships
    options = relationship("QuestionOption", back_populates="question", cascade="all, delete-orphan")
    tags = relationship("QuestionTag", back_populates="question", cascade="all, delete-orphan")
    test_cases = relationship("QuestionTestCase", back_populates="question", cascade="all, delete-orphan")
    code_stubs = relationship("QuestionCodeStub", back_populates="question", cascade="all, delete-orphan")


class QuestionOption(TimestampMixin, Base):
    __tablename__ = "question_options"

    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False
    )
    label: Mapped[str] = mapped_column(String(10), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    question = relationship("Question", back_populates="options")


class QuestionTag(Base):
    __tablename__ = "question_tags"

    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), primary_key=True
    )
    skill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True
    )

    # Relationships
    question = relationship("Question", back_populates="tags")
    skill = relationship("Skill")


class QuestionTestCase(TimestampMixin, Base):
    __tablename__ = "question_test_cases"

    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False
    )
    input: Mapped[str] = mapped_column(Text, nullable=False)
    expected_output: Mapped[str] = mapped_column(Text, nullable=False)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    time_limit_ms: Mapped[int] = mapped_column(Integer, default=5000)
    memory_limit_mb: Mapped[int] = mapped_column(Integer, default=256)

    # Relationships
    question = relationship("Question", back_populates="test_cases")


class QuestionCodeStub(TimestampMixin, Base):
    __tablename__ = "question_code_stubs"

    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False
    )
    language: Mapped[str] = mapped_column(String(20), nullable=False)
    stub_code: Mapped[str] = mapped_column(Text, nullable=False)
    solution_code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    question = relationship("Question", back_populates="code_stubs")
