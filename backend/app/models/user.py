import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"   # Platform owner — no org, full access
    ADMIN = "admin"               # Client/org owner — manages their org
    HR = "hr"                     # HR person — manages assessments & candidates
    TECH = "tech"                 # Technical user — creates questions & tests (scoped)
    CANDIDATE = "candidate"       # Legacy/unused (candidates use invitation tokens)


class User(TimestampMixin, Base):
    __tablename__ = "users"

    organization_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=True,
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="userrole", values_callable=lambda x: [e.value for e in x], create_type=False),
        nullable=False,
        default=UserRole.HR,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # JSON list of skill UUIDs (strings) — used for tech role to scope visible questions
    allowed_skill_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=None)

    # Relationships
    organization = relationship("Organization", back_populates="users")
