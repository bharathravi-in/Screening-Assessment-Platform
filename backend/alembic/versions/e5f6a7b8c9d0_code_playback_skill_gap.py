"""add code playback and skill gap analysis

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-02-21 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers
revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add code_snapshots JSONB column for code playback recording
    op.add_column(
        "candidate_responses",
        sa.Column("code_snapshots", JSONB, nullable=True, server_default=None,
                  comment="Array of {timestamp, code, language} snapshots for code playback"),
    )

    # Add is_flagged column for question flagging during test
    op.add_column(
        "candidate_responses",
        sa.Column("is_flagged", sa.Boolean(), nullable=False, server_default="false"),
    )

    # Add skill_scores JSONB to sessions for skill-gap analysis
    op.add_column(
        "candidate_sessions",
        sa.Column("skill_scores", JSONB, nullable=True, server_default=None,
                  comment="Per-skill performance: {skill_name: {score, max, pct}}"),
    )

    # Add adaptive_state JSONB to sessions for adaptive engine state
    op.add_column(
        "candidate_sessions",
        sa.Column("adaptive_state", JSONB, nullable=True, server_default=None,
                  comment="Adaptive engine state: difficulty_history, accuracy, etc."),
    )


def downgrade() -> None:
    op.drop_column("candidate_sessions", "adaptive_state")
    op.drop_column("candidate_sessions", "skill_scores")
    op.drop_column("candidate_responses", "is_flagged")
    op.drop_column("candidate_responses", "code_snapshots")
