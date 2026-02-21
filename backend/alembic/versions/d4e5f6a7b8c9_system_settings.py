"""system settings and org settings expansion

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-02-21 17:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None

_DEFAULT_AI_CONFIG = {
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
        "models": ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
    },
    "gemini": {
        "enabled": False,
        "api_key": "",
        "default_model": "gemini-1.5-pro",
        "models": ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"],
    },
}

_DEFAULT_ASSESSMENT = {
    "default_time_limit_minutes": 60,
    "default_passing_score": 70,
    "randomize_questions": False,
    "show_results_immediately": True,
    "allow_backward_navigation": True,
    "instructions_template": "",
}

_DEFAULT_NOTIFICATIONS = {
    "notify_on_completion": True,
    "notify_on_violation": True,
    "alert_emails": [],
    "completion_email_subject": "Assessment Completed",
}


def upgrade():
    import json

    # ── Create system_settings table (singleton) ───────────────────────────
    op.create_table(
        'system_settings',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        # AI
        sa.Column('ai_providers_config', JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column('default_ai_provider', sa.String(50), nullable=False, server_default='openai'),
        # Platform
        sa.Column('maintenance_mode', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('maintenance_message', sa.Text, nullable=True),
        sa.Column('allow_org_self_registration', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('max_orgs', sa.Integer, nullable=False, server_default='100'),
        sa.Column('max_users_per_org', sa.Integer, nullable=False, server_default='50'),
        sa.Column('max_assessments_per_org', sa.Integer, nullable=False, server_default='500'),
        sa.Column('max_candidates_per_assessment', sa.Integer, nullable=False, server_default='500'),
        # Security
        sa.Column('access_token_expire_minutes', sa.Integer, nullable=False, server_default='60'),
        sa.Column('refresh_token_expire_days', sa.Integer, nullable=False, server_default='7'),
        sa.Column('password_min_length', sa.Integer, nullable=False, server_default='8'),
        sa.Column('password_require_uppercase', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('password_require_numbers', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('password_require_special', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('max_login_attempts', sa.Integer, nullable=False, server_default='5'),
        sa.Column('lockout_duration_minutes', sa.Integer, nullable=False, server_default='15'),
        # Email
        sa.Column('smtp_host', sa.String(255), nullable=True),
        sa.Column('smtp_port', sa.Integer, nullable=False, server_default='587'),
        sa.Column('smtp_username', sa.String(255), nullable=True),
        sa.Column('smtp_password', sa.String(255), nullable=True),
        sa.Column('smtp_from_address', sa.String(255), nullable=True),
        sa.Column('smtp_from_name', sa.String(255), nullable=False, server_default="'Assessment Platform'"),
        sa.Column('smtp_use_tls', sa.Boolean, nullable=False, server_default='true'),
        # Rate Limiting
        sa.Column('api_rate_limit_per_minute', sa.Integer, nullable=False, server_default='60'),
        sa.Column('candidate_rate_limit_per_minute', sa.Integer, nullable=False, server_default='120'),
    )

    # Insert the singleton row with defaults
    op.execute(
        sa.text(
            "INSERT INTO system_settings (ai_providers_config, default_ai_provider) "
            f"VALUES ('{json.dumps(_DEFAULT_AI_CONFIG)}'::jsonb, 'openai')"
        )
    )

    # ── Expand org_settings with assessment_defaults + notification_config ──
    op.add_column('org_settings',
        sa.Column('assessment_defaults', JSONB, nullable=False,
                  server_default=sa.text(f"'{json.dumps(_DEFAULT_ASSESSMENT)}'::jsonb"))
    )
    op.add_column('org_settings',
        sa.Column('notification_config', JSONB, nullable=False,
                  server_default=sa.text(f"'{json.dumps(_DEFAULT_NOTIFICATIONS)}'::jsonb"))
    )


def downgrade():
    op.drop_column('org_settings', 'notification_config')
    op.drop_column('org_settings', 'assessment_defaults')
    op.drop_table('system_settings')
