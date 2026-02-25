"""Advanced Proctoring API endpoints.

Provides endpoints for:
- Webcam snapshot capture and retrieval
- Screen recording uploads
- Audio anomaly reporting
- Identity verification
- Proctoring event timeline
- AI plagiarism/LLM detection analysis
- Comprehensive proctoring reports
"""

import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_roles, get_candidate_session
from app.db.session import get_db
from app.models.candidate import CandidateSession
from app.models.response import CandidateResponse
from app.models.user import User
from app.models.proctoring_event import (
    ProctoringEvent,
    ProctoringSnapshot,
    IdentityVerification,
    PlagiarismReport,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["proctoring"])


# ---------------------------------------------------------------------------
# Request / Response Schemas
# ---------------------------------------------------------------------------

class SnapshotRequest(BaseModel):
    image_data: str = Field(..., description="Base64-encoded webcam image")
    captured_at: str = Field(..., description="ISO timestamp of capture")
    face_count: int | None = Field(None, description="Number of faces detected by client")
    anomaly_flags: dict | None = None


class AudioAlertRequest(BaseModel):
    noise_level: float = Field(..., ge=0, le=100, description="Noise level 0-100")
    duration_seconds: float = Field(0, description="Duration of the anomaly")
    alert_type: str = Field("noise_spike", description="Type: noise_spike | speech_detected | silence")
    details: str | None = None


class IdentityVerifyRequest(BaseModel):
    selfie_data: str = Field(..., description="Base64-encoded selfie image")
    id_document_data: str | None = Field(None, description="Base64-encoded ID document photo")


class ProctoringEventRequest(BaseModel):
    event_type: str
    severity: str = "warning"
    details: str | None = None
    metadata: dict | None = None
    client_timestamp: str | None = None


class AnalyzeIntegrityRequest(BaseModel):
    session_id: str


# ---------------------------------------------------------------------------
# Candidate endpoints (JWT protected via get_candidate_session)
# ---------------------------------------------------------------------------

@router.post("/snapshot")
async def upload_snapshot(
    body: SnapshotRequest,
    session: CandidateSession = Depends(get_candidate_session),
    db: AsyncSession = Depends(get_db),
):
    """Receive a periodic webcam snapshot from the candidate."""
    snapshot = ProctoringSnapshot(
        session_id=session.id,
        image_data=body.image_data[:500_000],  # Limit size ~375KB decoded
        face_count=body.face_count,
        anomaly_flags=body.anomaly_flags,
        captured_at=datetime.fromisoformat(body.captured_at) if body.captured_at else datetime.now(timezone.utc),
    )
    db.add(snapshot)

    # Generate face-count violations
    if body.face_count is not None:
        if body.face_count == 0:
            event = ProctoringEvent(
                session_id=session.id,
                event_type="webcam_face_missing",
                severity="warning",
                details="No face detected in webcam frame",
                client_timestamp=snapshot.captured_at,
            )
            db.add(event)
            session.proctoring_violations = (session.proctoring_violations or 0) + 1
        elif body.face_count > 1:
            event = ProctoringEvent(
                session_id=session.id,
                event_type="webcam_multi_face",
                severity="critical",
                details=f"{body.face_count} faces detected in webcam frame",
                client_timestamp=snapshot.captured_at,
            )
            db.add(event)
            session.proctoring_violations = (session.proctoring_violations or 0) + 1

    await db.flush()
    return {"status": "ok", "snapshot_id": str(snapshot.id)}


@router.post("/audio-alert")
async def report_audio_alert(
    body: AudioAlertRequest,
    session: CandidateSession = Depends(get_candidate_session),
    db: AsyncSession = Depends(get_db),
):
    """Report an audio environment anomaly detected by the client."""
    event = ProctoringEvent(
        session_id=session.id,
        event_type="audio_anomaly",
        severity="warning" if body.noise_level < 80 else "critical",
        details=body.details or f"Audio {body.alert_type}: level={body.noise_level:.1f}, duration={body.duration_seconds:.1f}s",
        metadata_={
            "noise_level": body.noise_level,
            "duration_seconds": body.duration_seconds,
            "alert_type": body.alert_type,
        },
    )
    db.add(event)

    # Only count as violation for critical noise
    if body.noise_level >= 70 or body.alert_type == "speech_detected":
        session.proctoring_violations = (session.proctoring_violations or 0) + 1

    await db.flush()
    return {"status": "ok", "event_id": str(event.id)}


@router.post("/verify-identity")
async def verify_identity(
    body: IdentityVerifyRequest,
    session: CandidateSession = Depends(get_candidate_session),
    db: AsyncSession = Depends(get_db),
):
    """Upload selfie and optional ID document for identity verification."""
    verification = IdentityVerification(
        session_id=session.id,
        selfie_data=body.selfie_data[:500_000],
        id_document_data=body.id_document_data[:500_000] if body.id_document_data else None,
        is_verified=False,
        verification_method="manual",
    )
    db.add(verification)
    await db.flush()

    return {
        "status": "submitted",
        "verification_id": str(verification.id),
        "message": "Identity verification submitted. Your assessment will continue while verification is processed.",
    }


@router.post("/event")
async def record_event(
    body: ProctoringEventRequest,
    request: Request,
    session: CandidateSession = Depends(get_candidate_session),
    db: AsyncSession = Depends(get_db),
):
    """Record a generic proctoring event from the client."""
    client_ip = request.client.host if request.client else None

    # Check for IP change
    if client_ip and session.ip_address and client_ip != session.ip_address:
        ip_event = ProctoringEvent(
            session_id=session.id,
            event_type="ip_change",
            severity="critical",
            details=f"IP changed from {session.ip_address} to {client_ip}",
            ip_address=client_ip,
        )
        db.add(ip_event)
        session.proctoring_violations = (session.proctoring_violations or 0) + 1
        session.ip_address = client_ip

    event = ProctoringEvent(
        session_id=session.id,
        event_type=body.event_type,
        severity=body.severity,
        details=body.details,
        metadata_=body.metadata,
        client_timestamp=(
            datetime.fromisoformat(body.client_timestamp)
            if body.client_timestamp else None
        ),
        ip_address=client_ip,
    )
    db.add(event)
    await db.flush()

    return {"status": "ok", "event_id": str(event.id)}


# ---------------------------------------------------------------------------
# HR/Admin review endpoints (role-protected)
# ---------------------------------------------------------------------------

@router.get("/{session_id}/report")
async def get_proctoring_report(
    session_id: UUID,
    user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    """Get comprehensive proctoring report for a test session."""
    session = await db.get(CandidateSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Count events by type
    event_counts_result = await db.execute(
        select(
            ProctoringEvent.event_type,
            ProctoringEvent.severity,
            func.count(ProctoringEvent.id),
        )
        .where(ProctoringEvent.session_id == session_id)
        .group_by(ProctoringEvent.event_type, ProctoringEvent.severity)
    )
    event_counts = [
        {"type": row[0], "severity": row[1], "count": row[2]}
        for row in event_counts_result.all()
    ]

    # Snapshot count
    snapshot_count_result = await db.execute(
        select(func.count(ProctoringSnapshot.id))
        .where(ProctoringSnapshot.session_id == session_id)
    )
    snapshot_count = snapshot_count_result.scalar() or 0

    # Identity verification status
    id_result = await db.execute(
        select(IdentityVerification)
        .where(IdentityVerification.session_id == session_id)
        .order_by(desc(IdentityVerification.created_at))
        .limit(1)
    )
    id_verification = id_result.scalar_one_or_none()

    # Plagiarism reports
    plag_result = await db.execute(
        select(PlagiarismReport)
        .where(PlagiarismReport.session_id == session_id)
    )
    plagiarism_reports = plag_result.scalars().all()

    # Calculate risk score
    total_events = sum(ec["count"] for ec in event_counts)
    critical_events = sum(ec["count"] for ec in event_counts if ec["severity"] == "critical")
    risk_score = min(100, (critical_events * 15) + (total_events * 3))

    max_plag = max((p.plagiarism_score for p in plagiarism_reports), default=0)
    max_llm = max((p.llm_probability for p in plagiarism_reports), default=0)
    risk_score = min(100, risk_score + max_plag * 0.3 + max_llm * 0.3)

    risk_level = "low"
    if risk_score >= 70:
        risk_level = "high"
    elif risk_score >= 40:
        risk_level = "medium"

    return {
        "session_id": str(session_id),
        "candidate_name": session.candidate_name,
        "candidate_email": session.candidate_email,
        "ip_address": session.ip_address,
        "risk_level": risk_level,
        "risk_score": round(risk_score, 1),
        "total_violations": session.proctoring_violations or 0,
        "event_summary": event_counts,
        "total_events": total_events,
        "snapshot_count": snapshot_count,
        "identity_verification": {
            "status": "verified" if (id_verification and id_verification.is_verified) else "not_verified" if id_verification else "not_submitted",
            "confidence": id_verification.confidence_score if id_verification else None,
            "method": id_verification.verification_method if id_verification else None,
        } if id_verification else {"status": "not_submitted"},
        "plagiarism_analysis": [
            {
                "response_id": str(p.response_id),
                "plagiarism_score": p.plagiarism_score,
                "llm_probability": p.llm_probability,
                "is_flagged": p.is_flagged,
                "findings": p.findings,
            }
            for p in plagiarism_reports
        ],
    }


@router.get("/{session_id}/snapshots")
async def get_session_snapshots(
    session_id: UUID,
    user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    """List webcam snapshots for a session (without full image data for listing)."""
    session = await db.get(CandidateSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    result = await db.execute(
        select(ProctoringSnapshot)
        .where(ProctoringSnapshot.session_id == session_id)
        .order_by(ProctoringSnapshot.captured_at)
    )
    snapshots = result.scalars().all()

    return {
        "session_id": str(session_id),
        "total": len(snapshots),
        "snapshots": [
            {
                "id": str(s.id),
                "captured_at": s.captured_at.isoformat() if s.captured_at else None,
                "face_count": s.face_count,
                "anomaly_flags": s.anomaly_flags,
                "image_data": s.image_data,  # Include for review
            }
            for s in snapshots
        ],
    }


@router.get("/{session_id}/timeline")
async def get_proctoring_timeline(
    session_id: UUID,
    user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    """Get chronological timeline of all proctoring events for a session."""
    session = await db.get(CandidateSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    result = await db.execute(
        select(ProctoringEvent)
        .where(ProctoringEvent.session_id == session_id)
        .order_by(ProctoringEvent.created_at)
    )
    events = result.scalars().all()

    return {
        "session_id": str(session_id),
        "total_events": len(events),
        "events": [
            {
                "id": str(e.id),
                "type": e.event_type,
                "severity": e.severity,
                "details": e.details,
                "metadata": e.metadata_,
                "client_timestamp": e.client_timestamp.isoformat() if e.client_timestamp else None,
                "recorded_at": e.created_at.isoformat() if e.created_at else None,
                "ip_address": e.ip_address,
            }
            for e in events
        ],
    }


@router.post("/{session_id}/analyze-integrity")
async def analyze_session_integrity(
    session_id: UUID,
    user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    """Run AI plagiarism and LLM detection on all code/text responses in a session."""
    session = await db.get(CandidateSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get all responses
    result = await db.execute(
        select(CandidateResponse)
        .where(CandidateResponse.session_id == session_id)
    )
    responses = result.scalars().all()

    if not responses:
        return {"session_id": str(session_id), "message": "No responses to analyze", "reports": []}

    from app.ai.agents.plagiarism_detector import PlagiarismDetectorAgent
    from app.ai.agents.llm_answer_detector import LLMAnswerDetectorAgent
    from app.services.code_playback import analyze_snapshots

    plagiarism_agent = PlagiarismDetectorAgent()
    llm_agent = LLMAnswerDetectorAgent()
    reports = []

    for resp in responses:
        submission = resp.code_response or resp.text_response
        if not submission:
            continue

        # Get behavioral metrics
        snapshots = resp.code_snapshots or []
        behavior = {}
        if snapshots:
            analysis = analyze_snapshots(snapshots)
            behavior = analysis.get("metrics", {})

        # Run plagiarism analysis
        plag_result = await plagiarism_agent.analyze(
            question_title=f"Question {resp.question_id}",
            language=resp.code_language or "text",
            difficulty="intermediate",
            code=submission,
            time_spent_seconds=int(resp.time_spent_seconds or 0),
            typing_anomalies=str(behavior.get("typing_anomalies", "none")),
            paste_events=behavior.get("paste_events", 0),
            snapshot_count=len(snapshots),
        )

        # Run LLM detection
        llm_result = await llm_agent.analyze(
            question_title=f"Question {resp.question_id}",
            question_type="code" if resp.code_response else "text",
            submission=submission,
            time_spent_seconds=int(resp.time_spent_seconds or 0),
            paste_events=behavior.get("paste_events", 0),
            typing_speed=behavior.get("typing_speed_cpm", 0),
            idle_periods=behavior.get("idle_periods", 0),
            typed_incrementally=behavior.get("typed_incrementally", True),
        )

        # Determine if flagged
        is_flagged = (
            plag_result.get("plagiarism_score", 0) >= 60
            or llm_result.get("llm_probability", 0) >= 70
        )

        # Save report
        report = PlagiarismReport(
            session_id=session_id,
            response_id=resp.id,
            plagiarism_score=plag_result.get("plagiarism_score", 0),
            llm_probability=llm_result.get("llm_probability", 0),
            findings={
                "plagiarism": plag_result,
                "llm_detection": llm_result,
            },
            flagged_segments=plag_result.get("flagged_segments", []),
            analysis_details={
                "behavioral_context": behavior,
            },
            is_flagged=is_flagged,
        )
        db.add(report)

        reports.append({
            "response_id": str(resp.id),
            "plagiarism_score": plag_result.get("plagiarism_score", 0),
            "llm_probability": llm_result.get("llm_probability", 0),
            "is_flagged": is_flagged,
            "plagiarism_summary": plag_result.get("summary", ""),
            "llm_summary": llm_result.get("summary", ""),
        })

    await db.flush()

    return {
        "session_id": str(session_id),
        "total_analyzed": len(reports),
        "flagged_count": sum(1 for r in reports if r["is_flagged"]),
        "reports": reports,
    }


@router.post("/{session_id}/verify-identity-review")
async def review_identity_verification(
    session_id: UUID,
    body: dict,
    user: User = Depends(require_roles("admin", "hr")),
    db: AsyncSession = Depends(get_db),
):
    """HR reviews and approves/rejects identity verification."""
    result = await db.execute(
        select(IdentityVerification)
        .where(IdentityVerification.session_id == session_id)
        .order_by(desc(IdentityVerification.created_at))
        .limit(1)
    )
    verification = result.scalar_one_or_none()
    if not verification:
        raise HTTPException(status_code=404, detail="No identity verification found")

    verification.is_verified = body.get("approved", False)
    verification.confidence_score = body.get("confidence_score", None)
    verification.reviewer_notes = body.get("notes", "")
    verification.verified_at = datetime.now(timezone.utc) if verification.is_verified else None

    await db.flush()

    return {
        "verification_id": str(verification.id),
        "is_verified": verification.is_verified,
        "message": "Identity verification updated",
    }
