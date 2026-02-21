from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import get_current_user, is_super_admin, require_roles, same_org
from app.core.security import hash_password
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.user import (
    UserCreate,
    UserListResponse,
    UserResponse,
    UserRoleUpdate,
    UserUpdate,
)

router = APIRouter()


@router.get("/", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    role: str | None = None,
    search: str | None = None,
    org_id: str | None = None,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    query = select(User)

    # Scope by organization:
    # super_admin sees all; admin/hr/tech see only their org
    if not is_super_admin(current_user):
        if current_user.organization_id:
            query = query.where(User.organization_id == current_user.organization_id)
    elif org_id:
        # super_admin can filter by org
        query = query.where(User.organization_id == org_id)

    if role:
        query = query.where(User.role == role)
    if search:
        query = query.where(
            User.full_name.ilike(f"%{search}%") | User.email.ilike(f"%{search}%")
        )

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.offset((page - 1) * page_size).limit(page_size).order_by(User.created_at.desc())
    result = await db.execute(query)
    users = result.scalars().all()

    return UserListResponse(
        users=[UserResponse.model_validate(u) for u in users],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    request: UserCreate,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    # admin can only create hr/tech within their own org
    if not is_super_admin(current_user):
        if request.role not in ("hr", "tech"):
            raise HTTPException(
                status_code=403,
                detail="Admins can only create hr or tech users",
            )
        if request.organization_id and request.organization_id != current_user.organization_id:
            raise HTTPException(
                status_code=403,
                detail="Cannot create users for another organization",
            )
        # Force the org to match admin's org
        request = request.model_copy(update={"organization_id": current_user.organization_id})

    # Check email uniqueness
    result = await db.execute(select(User).where(User.email == request.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=request.email,
        password_hash=hash_password(request.password),
        full_name=request.full_name,
        role=request.role,
        organization_id=request.organization_id,
        allowed_skill_ids=request.allowed_skill_ids,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    return UserResponse.model_validate(user)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Non-super_admin can only view users in their org (or themselves)
    if not is_super_admin(current_user) and user.id != current_user.id:
        if not same_org(current_user, user.organization_id):
            raise HTTPException(status_code=403, detail="Access denied")

    return UserResponse.model_validate(user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    request: UserUpdate,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not is_super_admin(current_user) and not same_org(current_user, user.organization_id):
        raise HTTPException(status_code=403, detail="Cannot update users from other organizations")

    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    await db.flush()
    await db.refresh(user)

    return UserResponse.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    if not is_super_admin(current_user) and not same_org(current_user, user.organization_id):
        raise HTTPException(status_code=403, detail="Cannot delete users from other organizations")

    # Prevent demoting super_admin accounts by non-super_admin
    if user.role == UserRole.SUPER_ADMIN and not is_super_admin(current_user):
        raise HTTPException(status_code=403, detail="Cannot delete a super admin account")

    user.is_active = False
    await db.flush()


@router.put("/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: UUID,
    request: UserRoleUpdate,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not is_super_admin(current_user):
        # admins can only reassign within their org, and only to hr/tech
        if not same_org(current_user, user.organization_id):
            raise HTTPException(status_code=403, detail="Cannot modify users from other organizations")
        if request.role not in ("hr", "tech"):
            raise HTTPException(status_code=403, detail="Admins can only assign hr or tech roles")

    user.role = request.role
    if request.allowed_skill_ids is not None:
        user.allowed_skill_ids = request.allowed_skill_ids

    await db.flush()
    await db.refresh(user)

    return UserResponse.model_validate(user)
