"""Resume model for storing parsed resume data."""

import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class Resume(TimestampMixin, Base):
    __tablename__ = "resumes"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True
    )
    candidate_email: Mapped[str] = mapped_column(String(255), index=True)
    candidate_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_path: Mapped[str] = mapped_column(String(500))
    file_type: Mapped[str] = mapped_column(String(20))  # pdf, docx
    file_size_bytes: Mapped[int | None] = mapped_column(nullable=True)
    parsed_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    matched_skills: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="uploaded"
    )  # uploaded, parsing, parsed, failed
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
