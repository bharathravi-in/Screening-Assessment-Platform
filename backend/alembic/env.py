import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.config import settings
from app.db.base import Base

# Import all models so they are registered with Base.metadata
from app.models.user import User  # noqa: F401
from app.models.organization import Organization, OrgSettings  # noqa: F401
from app.models.taxonomy import Technology, Skill, DifficultyLevel  # noqa: F401
from app.models.question import Question, QuestionOption, QuestionTag, QuestionTestCase, QuestionCodeStub  # noqa: F401
from app.models.assessment import Assessment, AssessmentSection, AssessmentQuestion  # noqa: F401
from app.models.candidate import CandidateInvitation, CandidateSession  # noqa: F401
from app.models.response import CandidateResponse  # noqa: F401
from app.models.resume import Resume  # noqa: F401
from app.models.system_settings import SystemSettings  # noqa: F401
from app.models.proctoring_event import ProctoringEvent, ProctoringSnapshot, IdentityVerification, PlagiarismReport  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = settings.database_url
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = settings.database_url
    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
