"""Analytics API endpoints."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, cast, func, select, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_roles
from app.db.session import get_db
from app.models.assessment import Assessment
from app.models.candidate import CandidateInvitation, CandidateSession
from app.models.question import Question
from app.models.response import CandidateResponse
from app.models.user import User
from app.schemas.analytics import (
    AnalyticsOverview,
    AssessmentStat,
    DailyCount,
    DifficultyPerformance,
    OverviewStats,
    ScoreBucket,
    StatusCount,
    TypePerformance,
)

router = APIRouter()


@router.get("/overview", response_model=AnalyticsOverview)
async def get_analytics_overview(
    days: int = Query(30, ge=7, le=365),
    user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    org_id = user.organization_id
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # ---------- overview counts ----------
    total_assessments = (await db.execute(
        select(func.count()).select_from(Assessment).where(
            Assessment.organization_id == org_id, Assessment.is_active == True
        )
    )).scalar() or 0

    active_assessments = (await db.execute(
        select(func.count()).select_from(Assessment).where(
            Assessment.organization_id == org_id,
            Assessment.is_active == True,
            Assessment.status.in_(["published", "active"]),
        )
    )).scalar() or 0

    total_invitations = (await db.execute(
        select(func.count()).select_from(CandidateInvitation).where(
            CandidateInvitation.organization_id == org_id
        )
    )).scalar() or 0

    total_sessions = (await db.execute(
        select(func.count()).select_from(CandidateSession).where(
            CandidateSession.organization_id == org_id
        )
    )).scalar() or 0

    completed_sessions = (await db.execute(
        select(func.count()).select_from(CandidateSession).where(
            CandidateSession.organization_id == org_id,
            CandidateSession.status == "completed",
        )
    )).scalar() or 0

    completion_rate = (completed_sessions / total_sessions * 100) if total_sessions else 0.0

    avg_score_row = (await db.execute(
        select(func.avg(CandidateSession.score_pct)).where(
            CandidateSession.organization_id == org_id,
            CandidateSession.status == "completed",
            CandidateSession.score_pct.isnot(None),
        )
    )).scalar()
    avg_score_pct = round(float(avg_score_row), 1) if avg_score_row is not None else None

    passed_count = (await db.execute(
        select(func.count()).select_from(CandidateSession).where(
            CandidateSession.organization_id == org_id,
            CandidateSession.status == "completed",
            CandidateSession.is_passed == True,
        )
    )).scalar() or 0
    pass_rate = round(passed_count / completed_sessions * 100, 1) if completed_sessions else None

    overview = OverviewStats(
        total_assessments=total_assessments,
        active_assessments=active_assessments,
        total_invitations=total_invitations,
        total_sessions=total_sessions,
        completed_sessions=completed_sessions,
        completion_rate=round(completion_rate, 1),
        avg_score_pct=avg_score_pct,
        pass_rate=pass_rate,
    )

    # ---------- score distribution ----------
    buckets = [
        ("0-20", 0, 20), ("21-40", 21, 40), ("41-60", 41, 60),
        ("61-80", 61, 80), ("81-100", 81, 100),
    ]
    score_dist: list[ScoreBucket] = []
    for label, lo, hi in buckets:
        cnt = (await db.execute(
            select(func.count()).select_from(CandidateSession).where(
                CandidateSession.organization_id == org_id,
                CandidateSession.status == "completed",
                CandidateSession.score_pct >= lo,
                CandidateSession.score_pct <= hi,
            )
        )).scalar() or 0
        score_dist.append(ScoreBucket(range=label, count=cnt))

    # ---------- session statuses ----------
    sess_statuses_q = await db.execute(
        select(CandidateSession.status, func.count())
        .where(CandidateSession.organization_id == org_id)
        .group_by(CandidateSession.status)
    )
    session_statuses = [
        StatusCount(status=row[0], count=row[1]) for row in sess_statuses_q.all()
    ]

    # ---------- invitation statuses ----------
    inv_statuses_q = await db.execute(
        select(CandidateInvitation.status, func.count())
        .where(CandidateInvitation.organization_id == org_id)
        .group_by(CandidateInvitation.status)
    )
    invitation_statuses = [
        StatusCount(status=row[0], count=row[1]) for row in inv_statuses_q.all()
    ]

    # ---------- top assessments ----------
    top_q = await db.execute(
        select(
            Assessment.id,
            Assessment.title,
            func.count(CandidateSession.id).label("sess_count"),
            func.avg(CandidateSession.score_pct).label("avg_score"),
            func.sum(case((CandidateSession.is_passed == True, 1), else_=0)).label("pass_cnt"),
            func.sum(case((CandidateSession.status == "completed", 1), else_=0)).label("comp_cnt"),
        )
        .join(CandidateSession, CandidateSession.assessment_id == Assessment.id, isouter=True)
        .where(Assessment.organization_id == org_id, Assessment.is_active == True)
        .group_by(Assessment.id, Assessment.title)
        .order_by(func.count(CandidateSession.id).desc())
        .limit(10)
    )
    top_assessments = []
    for row in top_q.all():
        comp = int(row.comp_cnt or 0)
        top_assessments.append(AssessmentStat(
            assessment_id=str(row.id),
            title=row.title,
            sessions=row.sess_count,
            avg_score=round(float(row.avg_score), 1) if row.avg_score is not None else None,
            pass_rate=round(int(row.pass_cnt or 0) / comp * 100, 1) if comp else None,
            completions=comp,
        ))

    # ---------- difficulty performance ----------
    diff_q = await db.execute(
        select(
            Question.difficulty,
            func.avg(
                case(
                    (CandidateResponse.max_score > 0,
                     CandidateResponse.final_score / CandidateResponse.max_score * 100),
                    else_=None,
                )
            ).label("avg_pct"),
            func.count(CandidateResponse.id).label("cnt"),
        )
        .join(CandidateResponse, CandidateResponse.question_id == Question.id)
        .join(CandidateSession, CandidateSession.id == CandidateResponse.session_id)
        .where(
            CandidateSession.organization_id == org_id,
            CandidateResponse.is_submitted == True,
        )
        .group_by(Question.difficulty)
    )
    difficulty_performance = [
        DifficultyPerformance(
            difficulty=row.difficulty,
            avg_score_pct=round(float(row.avg_pct), 1) if row.avg_pct is not None else None,
            count=row.cnt,
        )
        for row in diff_q.all()
    ]

    # ---------- question type performance ----------
    type_q = await db.execute(
        select(
            Question.type,
            func.avg(
                case(
                    (CandidateResponse.max_score > 0,
                     CandidateResponse.final_score / CandidateResponse.max_score * 100),
                    else_=None,
                )
            ).label("avg_pct"),
            func.count(CandidateResponse.id).label("cnt"),
        )
        .join(CandidateResponse, CandidateResponse.question_id == Question.id)
        .join(CandidateSession, CandidateSession.id == CandidateResponse.session_id)
        .where(
            CandidateSession.organization_id == org_id,
            CandidateResponse.is_submitted == True,
        )
        .group_by(Question.type)
    )
    type_performance = [
        TypePerformance(
            question_type=row.type,
            avg_score_pct=round(float(row.avg_pct), 1) if row.avg_pct is not None else None,
            count=row.cnt,
        )
        for row in type_q.all()
    ]

    # ---------- daily sessions (last N days) ----------
    daily_q = await db.execute(
        select(
            func.date(CandidateSession.created_at).label("dt"),
            func.count().label("cnt"),
        )
        .where(
            CandidateSession.organization_id == org_id,
            CandidateSession.created_at >= cutoff,
        )
        .group_by(func.date(CandidateSession.created_at))
        .order_by(func.date(CandidateSession.created_at))
    )
    daily_sessions = [
        DailyCount(date=str(row.dt), count=row.cnt) for row in daily_q.all()
    ]

    return AnalyticsOverview(
        overview=overview,
        score_distribution=score_dist,
        session_statuses=session_statuses,
        invitation_statuses=invitation_statuses,
        top_assessments=top_assessments,
        difficulty_performance=difficulty_performance,
        type_performance=type_performance,
        daily_sessions=daily_sessions,
    )
