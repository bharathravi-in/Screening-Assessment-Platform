from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token, is_token_blacklisted
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.candidate import CandidateSession

security_scheme = HTTPBearer()
optional_security_scheme = HTTPBearer(auto_error=False)


def is_super_admin(user: User) -> bool:
    return user.role == UserRole.SUPER_ADMIN


def same_org(user: User, org_id: Optional[UUID]) -> bool:
    """True if user belongs to org_id OR user is super_admin (global access)."""
    if is_super_admin(user):
        return True
    return user.organization_id is not None and user.organization_id == org_id


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials

    if is_token_blacklisted(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
        )

    try:
        payload = decode_token(token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return user


def require_roles(*roles: str):
    """
    Dependency factory that enforces role-based access.
    super_admin always passes regardless of the requested roles.
    """
    async def role_checker(user: User = Depends(get_current_user)) -> User:
        # super_admin bypasses ALL role guards
        if user.role == UserRole.SUPER_ADMIN:
            return user
        if user.role.value not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user

    return role_checker


def require_super_admin():
    """Restrict endpoint to super_admin only (platform-level operations)."""
    async def checker(user: User = Depends(get_current_user)) -> User:
        if user.role != UserRole.SUPER_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Super admin access required",
            )
        return user
    return checker


def require_org_admin():
    """
    Allow super_admin (all orgs) or admin (own org only).
    Callers apply org filtering themselves using same_org().
    """
    async def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in (UserRole.SUPER_ADMIN, UserRole.ADMIN):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Organization admin access required",
            )
        return user
    return checker


async def get_candidate_session(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> CandidateSession:
    """Extract candidate session from a candidate JWT token."""
    token = credentials.credentials

    try:
        payload = decode_token(token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    if payload.get("type") != "candidate":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type — candidate token required",
        )

    session_id = payload.get("sub")
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    result = await db.execute(
        select(CandidateSession).where(CandidateSession.id == UUID(session_id))
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    if session.status in ("completed", "terminated", "timed_out"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Session is no longer active",
        )

    return session


async def get_candidate_session_any_status(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> CandidateSession:
    """Extract candidate session from JWT — allows any status (for results/completion pages)."""
    token = credentials.credentials

    try:
        payload = decode_token(token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    if payload.get("type") != "candidate":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type — candidate token required",
        )

    session_id = payload.get("sub")
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    result = await db.execute(
        select(CandidateSession).where(CandidateSession.id == UUID(session_id))
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    return session
