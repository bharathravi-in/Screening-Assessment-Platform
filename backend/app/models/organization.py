import uuid
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Organization(TimestampMixin, Base):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    logo_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    users = relationship("User", back_populates="organization")
    settings = relationship("OrgSettings", back_populates="organization", uselist=False)


class OrgSettings(TimestampMixin, Base):
    __tablename__ = "org_settings"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        unique=True,
        nullable=False,
    )
    theme_config: Mapped[dict] = mapped_column(JSONB, default=dict)
    proctoring_defaults: Mapped[dict] = mapped_column(
        JSONB,
        default=lambda: {
            "copy_paste_disabled": True,
            "tab_switch_detection": True,
            "fullscreen_enforced": True,
            "right_click_disabled": True,
            "keyboard_shortcuts_restricted": True,
        },
    )
    max_violation_warnings: Mapped[int] = mapped_column(Integer, default=3)
    auto_terminate_on_violations: Mapped[bool] = mapped_column(Boolean, default=True)
    allowed_ai_providers: Mapped[list] = mapped_column(JSONB, default=lambda: ["openai"])
    assessment_defaults: Mapped[dict] = mapped_column(
        JSONB,
        default=lambda: {
            "default_time_limit_minutes": 60,
            "default_passing_score": 70,
            "randomize_questions": False,
            "show_results_immediately": True,
            "allow_backward_navigation": True,
            "instructions_template": "",
        },
    )
    notification_config: Mapped[dict] = mapped_column(
        JSONB,
        default=lambda: {
            "notify_on_completion": True,
            "notify_on_violation": True,
            "alert_emails": [],
            "completion_email_subject": "Assessment Completed",
        },
    )

    # Relationships
    organization = relationship("Organization", back_populates="settings")
