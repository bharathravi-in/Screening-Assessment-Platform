import enum
import uuid
from typing import Optional

from sqlalchemy import Boolean, Enum, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class TechnologyCategory(str, enum.Enum):
    LANGUAGE = "language"
    FRAMEWORK = "framework"
    DATABASE = "database"
    CLOUD = "cloud"
    TOOL = "tool"
    CONCEPT = "concept"
    OTHER = "other"


class DifficultyEnum(str, enum.Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


class Technology(TimestampMixin, Base):
    __tablename__ = "technologies"
    __table_args__ = (
        # name must be unique within global scope OR within each org
        UniqueConstraint("name", "organization_id", name="uq_technology_name_org"),
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    category: Mapped[TechnologyCategory] = mapped_column(
        Enum(TechnologyCategory), nullable=False, default=TechnologyCategory.LANGUAGE
    )
    icon_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # NULL = global master (super_admin); UUID = org-specific addition (admin)
    organization_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True
    )

    # Relationships
    skills = relationship("Skill", back_populates="technology", cascade="all, delete-orphan")


class Skill(TimestampMixin, Base):
    __tablename__ = "skills"

    technology_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("technologies.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    difficulty_default: Mapped[Optional[DifficultyEnum]] = mapped_column(
        Enum(DifficultyEnum), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    technology = relationship("Technology", back_populates="skills")


class DifficultyLevel(TimestampMixin, Base):
    __tablename__ = "difficulty_levels"

    organization_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    numeric_value: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    time_multiplier: Mapped[float] = mapped_column(Float, default=1.0)
