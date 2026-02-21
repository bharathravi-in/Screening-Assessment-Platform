"""taxonomy org scoping

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-02-21 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade():
    # Drop the old unique index on name alone
    op.drop_index('ix_technologies_name', table_name='technologies')

    # Add organization_id column (NULL = global master)
    op.add_column('technologies',
        sa.Column('organization_id', UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=True)
    )
    op.create_index('ix_technologies_organization_id', 'technologies', ['organization_id'])

    # New composite unique: (name, organization_id)
    # Note: PostgreSQL treats two NULLs as NOT equal in unique constraints,
    # so global techs (org_id=NULL) with same name won't violate uniqueness naturally.
    # We use a partial unique index for global techs + constraint for org-specific.
    op.execute(
        "CREATE UNIQUE INDEX uq_tech_name_global ON technologies (name) WHERE organization_id IS NULL"
    )
    op.create_unique_constraint('uq_technology_name_org', 'technologies', ['name', 'organization_id'])


def downgrade():
    op.drop_constraint('uq_technology_name_org', 'technologies', type_='unique')
    op.execute("DROP INDEX IF EXISTS uq_tech_name_global")
    op.drop_index('ix_technologies_organization_id', table_name='technologies')
    op.drop_column('technologies', 'organization_id')
    op.create_index('ix_technologies_name', 'technologies', ['name'], unique=True)
