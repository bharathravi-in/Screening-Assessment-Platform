"""add_super_admin_tech_roles

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-21

Adds super_admin and tech to the userrole enum and an allowed_skill_ids
JSON column to users (used to scope tech users to specific skill areas).
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL enum ADD VALUE must run outside a transaction block
    op.execute("COMMIT")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'super_admin'")
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'tech'")
    # Re-open transaction for subsequent DDL
    op.execute("BEGIN")

    # Add allowed_skill_ids column for tech role scoping
    op.add_column(
        'users',
        sa.Column('allowed_skill_ids', JSON, nullable=True, server_default=None),
    )


def downgrade() -> None:
    op.drop_column('users', 'allowed_skill_ids')
    # Note: PostgreSQL does not support DROP VALUE from enums.
    # To fully revert the enum, you'd need to recreate it:
    # ALTER TABLE users ALTER COLUMN role TYPE text;
    # DROP TYPE userrole;
    # CREATE TYPE userrole AS ENUM ('admin','hr','candidate');
    # ALTER TABLE users ALTER COLUMN role TYPE userrole USING role::userrole;
