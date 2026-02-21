import uuid
from typing import Optional

from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class SystemSettings(TimestampMixin, Base):
    """
    Platform-wide settings — singleton row, owned by super_admin only.
    AI configuration, security policy, SMTP, rate limits, etc.
    """
    __tablename__ = "system_settings"

    # ── AI Configuration ─────────────────────────────────────────────────────
    # Per-provider config: {openai: {enabled, api_key, default_model, models[]}}
    ai_providers_config: Mapped[dict] = mapped_column(
        JSONB,
        default=lambda: {
            "openai": {
                "enabled": True,
                "api_key": "",
                "default_model": "gpt-4o-mini",
                "models": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
            },
            "anthropic": {
                "enabled": False,
                "api_key": "",
                "default_model": "claude-3-5-sonnet-20241022",
                "models": [
                    "claude-3-5-sonnet-20241022",
                    "claude-3-5-haiku-20241022",
                    "claude-3-opus-20240229",
                ],
            },
            "gemini": {
                "enabled": False,
                "api_key": "",
                "default_model": "gemini-1.5-pro",
                "models": ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"],
            },
        },
        nullable=False,
    )
    default_ai_provider: Mapped[str] = mapped_column(String(50), default="openai", nullable=False)

    # ── Platform ──────────────────────────────────────────────────────────────
    maintenance_mode: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    maintenance_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    allow_org_self_registration: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    max_orgs: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    max_users_per_org: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    max_assessments_per_org: Mapped[int] = mapped_column(Integer, default=500, nullable=False)
    max_candidates_per_assessment: Mapped[int] = mapped_column(Integer, default=500, nullable=False)

    # ── Security ──────────────────────────────────────────────────────────────
    access_token_expire_minutes: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    refresh_token_expire_days: Mapped[int] = mapped_column(Integer, default=7, nullable=False)
    password_min_length: Mapped[int] = mapped_column(Integer, default=8, nullable=False)
    password_require_uppercase: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    password_require_numbers: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    password_require_special: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    max_login_attempts: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    lockout_duration_minutes: Mapped[int] = mapped_column(Integer, default=15, nullable=False)

    # ── Email / SMTP ──────────────────────────────────────────────────────────
    smtp_host: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    smtp_port: Mapped[int] = mapped_column(Integer, default=587, nullable=False)
    smtp_username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    smtp_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    smtp_from_address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    smtp_from_name: Mapped[str] = mapped_column(String(255), default="Assessment Platform", nullable=False)
    smtp_use_tls: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # ── Rate Limiting ─────────────────────────────────────────────────────────
    api_rate_limit_per_minute: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    candidate_rate_limit_per_minute: Mapped[int] = mapped_column(Integer, default=120, nullable=False)
