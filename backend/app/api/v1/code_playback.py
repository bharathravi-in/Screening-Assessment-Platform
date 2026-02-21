"""Code Playback API endpoints.

Provides endpoints for retrieving code snapshots and behavioral analytics
from candidate test sessions.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_roles
from app.db.session import get_db
from app.models.candidate import CandidateSession
from app.models.response import CandidateResponse
from app.models.user import User
from app.services.code_playback import analyze_snapshots

router = APIRouter(prefix="/code-playback", tags=["code-playback"])


@router.get("/{session_id}/{question_id}")
async def get_playback_data(
    session_id: UUID,
    question_id: UUID,
    user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    """Get code playback frames for a specific question in a session.

    Returns a list of playback frames with code, timestamps, and diffs
    that can be used to reconstruct the candidate's coding process.
    """
    # Verify session exists
    session = await db.get(CandidateSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get the response for this question
    result = await db.execute(
        select(CandidateResponse).where(
            CandidateResponse.session_id == session_id,
            CandidateResponse.question_id == question_id,
        )
    )
    response = result.scalar_one_or_none()

    if not response:
        raise HTTPException(status_code=404, detail="Response not found")

    snapshots = response.code_snapshots or []
    if not snapshots:
        return {"frames": [], "total_frames": 0, "message": "No code snapshots recorded"}

    analysis = analyze_snapshots(snapshots)
    frames = analysis["frames"]

    return {
        "session_id": str(session_id),
        "question_id": str(question_id),
        "frames": frames,
        "total_frames": len(frames),
    }


@router.get("/{session_id}/{question_id}/analytics")
async def get_behavior_analytics(
    session_id: UUID,
    question_id: UUID,
    user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    """Get behavioral analytics for a candidate's code response.

    Analyzes typing speed, paste events, idle periods, and anomaly scores.
    """
    # Verify session exists
    session = await db.get(CandidateSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get the response
    result = await db.execute(
        select(CandidateResponse).where(
            CandidateResponse.session_id == session_id,
            CandidateResponse.question_id == question_id,
        )
    )
    response = result.scalar_one_or_none()

    if not response:
        raise HTTPException(status_code=404, detail="Response not found")

    snapshots = response.code_snapshots or []
    if not snapshots:
        return {"metrics": {}, "message": "No code snapshots recorded"}

    analysis = analyze_snapshots(snapshots)

    return {
        "session_id": str(session_id),
        "question_id": str(question_id),
        "metrics": analysis["metrics"],
    }


@router.get("/{session_id}/overview")
async def get_session_behavior_overview(
    session_id: UUID,
    user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    """Get behavioral overview for all coding questions in a session.

    Aggregates behavior metrics across all code responses in the session.
    """
    session = await db.get(CandidateSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get all responses with code snapshots
    result = await db.execute(
        select(CandidateResponse).where(
            CandidateResponse.session_id == session_id,
            CandidateResponse.code_snapshots.isnot(None),
        )
    )
    responses = result.scalars().all()

    question_analytics = []
    total_anomaly_score = 0
    total_paste_events = 0
    total_active_time = 0
    total_idle_time = 0

    for resp in responses:
        if not resp.code_snapshots:
            continue
        analysis = analyze_snapshots(resp.code_snapshots)
        metrics = analysis["metrics"]
        question_analytics.append({
            "question_id": str(resp.question_id),
            "metrics": metrics,
        })
        total_anomaly_score += metrics.get("anomaly_score", 0)
        total_paste_events += metrics.get("paste_events", 0)
        total_active_time += metrics.get("active_time_seconds", 0)
        total_idle_time += metrics.get("idle_time_seconds", 0)

    avg_anomaly = total_anomaly_score / len(question_analytics) if question_analytics else 0

    return {
        "session_id": str(session_id),
        "total_code_questions": len(question_analytics),
        "avg_anomaly_score": round(avg_anomaly, 1),
        "total_paste_events": total_paste_events,
        "total_active_time_seconds": round(total_active_time, 1),
        "total_idle_time_seconds": round(total_idle_time, 1),
        "per_question": question_analytics,
    }
