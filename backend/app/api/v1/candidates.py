import logging
import secrets
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File as FastAPIFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.permissions import is_super_admin, require_roles, same_org
from app.db.session import get_db
from app.models.assessment import Assessment
from app.models.candidate import CandidateInvitation, CandidateSession
from app.models.response import CandidateResponse
from app.models.user import User
from app.models.organization import Organization
from app.services.email import send_invitation_email
from app.schemas.candidate import (
    BulkInviteRequest,
    InvitationListResponse,
    InvitationResponse,
    InvitationUpdate,
    InviteRequest,
    SessionDetailResponse,
    SessionListResponse,
    SessionResponse,
)

router = APIRouter()

logger = logging.getLogger(__name__)


def _build_invite_link(request: Request, token: str) -> str:
    """Build the candidate-facing invite link."""
    origin = request.headers.get("origin", "")
    if not origin:
        origin = str(request.base_url).rstrip("/")
        # Strip /api prefix if present
        if "/api" in origin:
            origin = origin.split("/api")[0]
    return f"{origin}/test/verify/{token}"


@router.post("/invite", response_model=InvitationResponse, status_code=status.HTTP_201_CREATED)
async def invite_candidate(
    request_body: InviteRequest,
    request: Request,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    # Verify assessment
    result = await db.execute(select(Assessment).where(Assessment.id == request_body.assessment_id))
    assessment = result.scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Check duplicate
    result = await db.execute(
        select(CandidateInvitation).where(
            CandidateInvitation.assessment_id == request_body.assessment_id,
            CandidateInvitation.candidate_email == request_body.candidate_email,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Candidate already invited to this assessment")

    invitation = CandidateInvitation(
        assessment_id=request_body.assessment_id,
        organization_id=assessment.organization_id,
        invited_by_id=current_user.id,
        candidate_email=request_body.candidate_email,
        candidate_name=request_body.candidate_name,
        token=secrets.token_urlsafe(48),
        status="pending",
        expires_at=request_body.expires_at,
        sent_at=datetime.now(timezone.utc),
    )
    db.add(invitation)
    await db.flush()
    await db.refresh(invitation)

    # Send invitation email (best-effort, don't fail request)
    try:
        org_name = ""
        if assessment.organization_id:
            org_result = await db.execute(select(Organization).where(Organization.id == assessment.organization_id))
            org = org_result.scalar_one_or_none()
            if org:
                org_name = org.name
        invite_link = _build_invite_link(request, invitation.token)
        sent = await send_invitation_email(
            db=db,
            candidate_email=invitation.candidate_email,
            candidate_name=invitation.candidate_name or "",
            assessment_title=assessment.title,
            invite_link=invite_link,
            expires_at=invitation.expires_at.isoformat() if invitation.expires_at else None,
            organization_name=org_name,
        )
        if sent:
            invitation.status = "sent"
            await db.flush()
    except Exception as exc:
        logger.warning("Email send failed for %s: %s", invitation.candidate_email, exc)

    return InvitationResponse.model_validate(invitation)


@router.post("/invite/bulk", response_model=list[InvitationResponse], status_code=status.HTTP_201_CREATED)
async def bulk_invite_candidates(
    request_body: BulkInviteRequest,
    request: Request,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    # Verify assessment
    result = await db.execute(select(Assessment).where(Assessment.id == request_body.assessment_id))
    assessment = result.scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Get org name for emails
    org_name = ""
    if assessment.organization_id:
        org_result = await db.execute(select(Organization).where(Organization.id == assessment.organization_id))
        org = org_result.scalar_one_or_none()
        if org:
            org_name = org.name

    invitations = []
    for candidate in request_body.candidates:
        # Skip duplicates silently
        result = await db.execute(
            select(CandidateInvitation).where(
                CandidateInvitation.assessment_id == request_body.assessment_id,
                CandidateInvitation.candidate_email == candidate.candidate_email,
            )
        )
        if result.scalar_one_or_none():
            continue

        invitation = CandidateInvitation(
            assessment_id=request_body.assessment_id,
            organization_id=assessment.organization_id,
            invited_by_id=current_user.id,
            candidate_email=candidate.candidate_email,
            candidate_name=candidate.candidate_name,
            token=secrets.token_urlsafe(48),
            status="pending",
            expires_at=candidate.expires_at,
            sent_at=datetime.now(timezone.utc),
        )
        db.add(invitation)
        invitations.append(invitation)

    await db.flush()
    for inv in invitations:
        await db.refresh(inv)

    # Send invitation emails (best-effort)
    for inv in invitations:
        try:
            invite_link = _build_invite_link(request, inv.token)
            sent = await send_invitation_email(
                db=db,
                candidate_email=inv.candidate_email,
                candidate_name=inv.candidate_name or "",
                assessment_title=assessment.title,
                invite_link=invite_link,
                expires_at=inv.expires_at.isoformat() if inv.expires_at else None,
                organization_name=org_name,
            )
            if sent:
                inv.status = "sent"
        except Exception as exc:
            logger.warning("Email send failed for %s: %s", inv.candidate_email, exc)
    await db.flush()

    return [InvitationResponse.model_validate(inv) for inv in invitations]


@router.post("/invite/upload-csv", status_code=status.HTTP_201_CREATED)
async def upload_csv_invite(
    assessment_id: str = Query(...),
    file: UploadFile = FastAPIFile(...),
    request: Request = None,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    """Upload a CSV file to bulk-invite candidates.

    CSV columns: email (required), name (optional), expires_at (optional ISO datetime).
    """
    import csv
    import io

    # Verify assessment
    result = await db.execute(select(Assessment).where(Assessment.id == assessment_id))
    assessment = result.scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Read CSV
    content = await file.read()
    try:
        text = content.decode("utf-8-sig")  # Handle BOM
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="Empty or invalid CSV file")

    # Normalize column names
    normalized_fields = {f.strip().lower().replace(" ", "_"): f for f in reader.fieldnames}
    email_col = normalized_fields.get("email") or normalized_fields.get("e-mail") or normalized_fields.get("email_address")
    name_col = normalized_fields.get("name") or normalized_fields.get("candidate_name") or normalized_fields.get("full_name")

    if not email_col:
        raise HTTPException(status_code=400, detail="CSV must have an 'email' column")

    # Get org name
    org_name = ""
    if assessment.organization_id:
        org_result = await db.execute(select(Organization).where(Organization.id == assessment.organization_id))
        org = org_result.scalar_one_or_none()
        if org:
            org_name = org.name

    invitations = []
    skipped = 0
    for row in reader:
        email = (row.get(email_col) or "").strip().lower()
        if not email or "@" not in email:
            skipped += 1
            continue

        name = (row.get(name_col) or "").strip() if name_col else ""

        # Skip duplicates
        result = await db.execute(
            select(CandidateInvitation).where(
                CandidateInvitation.assessment_id == assessment.id,
                CandidateInvitation.candidate_email == email,
            )
        )
        if result.scalar_one_or_none():
            skipped += 1
            continue

        invitation = CandidateInvitation(
            assessment_id=assessment.id,
            organization_id=assessment.organization_id,
            invited_by_id=current_user.id,
            candidate_email=email,
            candidate_name=name or None,
            token=secrets.token_urlsafe(48),
            status="pending",
            sent_at=datetime.now(timezone.utc),
        )
        db.add(invitation)
        invitations.append(invitation)

    await db.flush()
    for inv in invitations:
        await db.refresh(inv)

    # Send emails (best-effort)
    for inv in invitations:
        try:
            invite_link = _build_invite_link(request, inv.token)
            sent = await send_invitation_email(
                db=db,
                candidate_email=inv.candidate_email,
                candidate_name=inv.candidate_name or "",
                assessment_title=assessment.title,
                invite_link=invite_link,
                organization_name=org_name,
            )
            if sent:
                inv.status = "sent"
        except Exception as exc:
            logger.warning("CSV email failed for %s: %s", inv.candidate_email, exc)
    await db.flush()

    return {
        "invited": len(invitations),
        "skipped": skipped,
        "invitations": [InvitationResponse.model_validate(inv) for inv in invitations],
    }


@router.get("/invitations/", response_model=InvitationListResponse)
async def list_invitations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    assessment_id: UUID | None = None,
    invitation_status: str | None = None,
    search: str | None = None,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    query = select(CandidateInvitation)

    if not is_super_admin(current_user) and current_user.organization_id:
        query = query.where(CandidateInvitation.organization_id == current_user.organization_id)

    if assessment_id:
        query = query.where(CandidateInvitation.assessment_id == assessment_id)
    if invitation_status:
        query = query.where(CandidateInvitation.status == invitation_status)
    if search:
        query = query.where(
            CandidateInvitation.candidate_email.ilike(f"%{search}%")
            | CandidateInvitation.candidate_name.ilike(f"%{search}%")
        )

    # Count
    base_filter = select(CandidateInvitation.id)
    if not is_super_admin(current_user) and current_user.organization_id:
        base_filter = base_filter.where(CandidateInvitation.organization_id == current_user.organization_id)
    if assessment_id:
        base_filter = base_filter.where(CandidateInvitation.assessment_id == assessment_id)
    if invitation_status:
        base_filter = base_filter.where(CandidateInvitation.status == invitation_status)
    if search:
        base_filter = base_filter.where(
            CandidateInvitation.candidate_email.ilike(f"%{search}%")
            | CandidateInvitation.candidate_name.ilike(f"%{search}%")
        )
    total = (await db.execute(select(func.count()).select_from(base_filter.subquery()))).scalar() or 0

    query = query.order_by(CandidateInvitation.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    invitations = result.scalars().all()

    return InvitationListResponse(
        invitations=[InvitationResponse.model_validate(inv) for inv in invitations],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/invitations/{invitation_id}", response_model=InvitationResponse)
async def get_invitation(
    invitation_id: UUID,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CandidateInvitation).where(CandidateInvitation.id == invitation_id)
    )
    invitation = result.scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    if not same_org(current_user, invitation.organization_id):
        raise HTTPException(status_code=403, detail="Access denied")

    return InvitationResponse.model_validate(invitation)


@router.put("/invitations/{invitation_id}", response_model=InvitationResponse)
async def update_invitation(
    invitation_id: UUID,
    request: InvitationUpdate,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CandidateInvitation).where(CandidateInvitation.id == invitation_id)
    )
    invitation = result.scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    if not same_org(current_user, invitation.organization_id):
        raise HTTPException(status_code=403, detail="Access denied")

    for field, value in request.model_dump(exclude_unset=True).items():
        setattr(invitation, field, value)

    await db.flush()
    await db.refresh(invitation)
    return InvitationResponse.model_validate(invitation)


@router.get("/sessions/", response_model=SessionListResponse)
async def list_sessions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    assessment_id: UUID | None = None,
    session_status: str | None = None,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    query = select(CandidateSession)

    if not is_super_admin(current_user) and current_user.organization_id:
        query = query.where(CandidateSession.organization_id == current_user.organization_id)

    if assessment_id:
        query = query.where(CandidateSession.assessment_id == assessment_id)
    if session_status:
        query = query.where(CandidateSession.status == session_status)

    # Count
    base_filter = select(CandidateSession.id)
    if not is_super_admin(current_user) and current_user.organization_id:
        base_filter = base_filter.where(CandidateSession.organization_id == current_user.organization_id)
    if assessment_id:
        base_filter = base_filter.where(CandidateSession.assessment_id == assessment_id)
    if session_status:
        base_filter = base_filter.where(CandidateSession.status == session_status)
    total = (await db.execute(select(func.count()).select_from(base_filter.subquery()))).scalar() or 0

    query = query.order_by(CandidateSession.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    sessions = result.scalars().all()

    return SessionListResponse(
        sessions=[SessionResponse.model_validate(s) for s in sessions],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/sessions/{session_id}", response_model=SessionDetailResponse)
async def get_session(
    session_id: UUID,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CandidateSession)
        .options(selectinload(CandidateSession.responses))
        .where(CandidateSession.id == session_id)
    )
    session = result.unique().scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if not same_org(current_user, session.organization_id):
        raise HTTPException(status_code=403, detail="Access denied")

    return SessionDetailResponse.model_validate(session)


@router.get("/sessions/{session_id}/playback/{question_id}")
async def get_code_playback(
    session_id: UUID,
    question_id: UUID,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    """Get code snapshots for a specific question response (code playback)."""
    result = await db.execute(
        select(CandidateResponse).where(
            CandidateResponse.session_id == session_id,
            CandidateResponse.question_id == question_id,
        )
    )
    response = result.scalar_one_or_none()
    if not response:
        raise HTTPException(status_code=404, detail="Response not found")

    return {
        "question_id": str(question_id),
        "code_snapshots": response.code_snapshots or [],
        "final_code": response.code_response,
        "language": response.code_language,
        "time_spent_seconds": response.time_spent_seconds,
    }


@router.get("/ranking")
async def get_candidate_ranking(
    assessment_id: UUID = Query(...),
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    """Get comparative ranking of all candidates for an assessment."""
    query = (
        select(CandidateSession)
        .where(
            CandidateSession.assessment_id == assessment_id,
            CandidateSession.status.in_(["completed", "terminated", "timed_out"]),
        )
        .order_by(CandidateSession.score_pct.desc().nullslast())
    )

    if not is_super_admin(current_user) and current_user.organization_id:
        query = query.where(CandidateSession.organization_id == current_user.organization_id)

    result = await db.execute(query)
    sessions = result.scalars().all()

    rankings = []
    for rank, session in enumerate(sessions, 1):
        rankings.append({
            "rank": rank,
            "session_id": str(session.id),
            "candidate_name": session.candidate_name,
            "candidate_email": session.candidate_email,
            "status": session.status,
            "score_pct": session.score_pct,
            "total_score": session.total_score,
            "total_max_score": session.total_max_score,
            "is_passed": session.is_passed,
            "proctoring_violations": session.proctoring_violations,
            "started_at": session.started_at.isoformat() if session.started_at else None,
            "completed_at": session.completed_at.isoformat() if session.completed_at else None,
            "skill_scores": session.skill_scores,
        })

    return {
        "assessment_id": str(assessment_id),
        "total_candidates": len(rankings),
        "rankings": rankings,
    }
