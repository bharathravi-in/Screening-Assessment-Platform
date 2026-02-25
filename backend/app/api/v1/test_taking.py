"""Candidate test-taking API router.

Public and candidate-JWT-protected endpoints for taking assessments.
Candidates access tests via invitation tokens — no user authentication required.
"""

import random
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.permissions import get_candidate_session, get_candidate_session_any_status
from app.core.security import create_candidate_token
from app.db.session import get_db
from app.models.assessment import Assessment, AssessmentQuestion
from app.models.candidate import CandidateInvitation, CandidateSession
from app.models.question import Question, QuestionOption
from app.models.response import CandidateResponse
from app.schemas.test_taking import (
    CompletionResponse,
    NavigationRequest,
    ProctoringStatusResponse,
    ProctoringViolationRequest,
    ResponseSaveRequest,
    ResponseSaveResponse,
    SessionStateResponse,
    TestQuestionCodeStubDTO,
    TestQuestionDTO,
    TestQuestionOptionDTO,
    TestQuestionTestCaseDTO,
    TestStartRequest,
    TestStartResponse,
    TestSubmitResponse,
    TestVerifyResponse,
)
from app.services.scoring import auto_score_response, calculate_session_totals
from app.services.sandbox import sandbox_executor
from app.services.adaptive import PerformanceTracker, select_next_question

router = APIRouter(prefix="/test", tags=["test-taking"])

# Default maximum proctoring violations before session termination
DEFAULT_MAX_VIOLATIONS = 5


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_question_dto(aq: AssessmentQuestion) -> TestQuestionDTO:
    """Convert an AssessmentQuestion (with loaded Question) into a TestQuestionDTO.

    Strips correct-answer information from options and filters out hidden test cases.
    """
    q: Question = aq.question

    options = [
        TestQuestionOptionDTO(
            id=str(opt.id),
            label=opt.label,
            text=opt.text,
            order_index=opt.order_index,
        )
        for opt in sorted(q.options, key=lambda o: o.order_index)
    ]

    code_stubs = [
        TestQuestionCodeStubDTO(
            language=stub.language,
            stub_code=stub.stub_code,
        )
        for stub in q.code_stubs
    ]

    test_cases = [
        TestQuestionTestCaseDTO(
            id=str(tc.id),
            input=tc.input,
            expected_output=tc.expected_output,
            order_index=tc.order_index,
        )
        for tc in sorted(q.test_cases, key=lambda t: t.order_index)
        if tc.is_sample or not tc.is_hidden
    ]

    q_type = q.type.value if hasattr(q.type, "value") else q.type
    q_diff = q.difficulty.value if hasattr(q.difficulty, "value") else q.difficulty

    return TestQuestionDTO(
        id=str(q.id),
        assessment_question_id=str(aq.id),
        type=q_type,
        difficulty=q_diff,
        title=q.title,
        body=q.body,
        time_limit_seconds=q.time_limit_seconds,
        max_score=q.max_score,
        order_index=aq.order_index,
        weight=aq.weight,
        options=options,
        code_stubs=code_stubs,
        test_cases=test_cases,
    )


def _get_max_violations(assessment: Assessment) -> int:
    """Extract the max-violations threshold from the assessment proctoring config."""
    if assessment.proctoring_config and isinstance(assessment.proctoring_config, dict):
        return assessment.proctoring_config.get("max_violations", DEFAULT_MAX_VIOLATIONS)
    return DEFAULT_MAX_VIOLATIONS


def _proctoring_enabled(assessment: Assessment) -> bool:
    """Check whether proctoring is enabled for an assessment."""
    if assessment.proctoring_config and isinstance(assessment.proctoring_config, dict):
        return assessment.proctoring_config.get("enabled", False)
    return False


async def _load_assessment_questions(assessment_id: UUID, db: AsyncSession):
    """Load all AssessmentQuestions for an assessment with eager-loaded question data."""
    result = await db.execute(
        select(AssessmentQuestion)
        .where(AssessmentQuestion.assessment_id == assessment_id)
        .options(
            selectinload(AssessmentQuestion.question).selectinload(Question.options),
            selectinload(AssessmentQuestion.question).selectinload(Question.test_cases),
            selectinload(AssessmentQuestion.question).selectinload(Question.code_stubs),
        )
        .order_by(AssessmentQuestion.order_index)
    )
    return result.unique().scalars().all()


# ---------------------------------------------------------------------------
# GET /test/verify/{token}  — Public
# ---------------------------------------------------------------------------

@router.get("/verify/{token}", response_model=TestVerifyResponse)
async def verify_invitation(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Validate an invitation token and return assessment info.

    Updates invitation status to 'opened' if it was pending or sent.
    """
    result = await db.execute(
        select(CandidateInvitation)
        .where(CandidateInvitation.token == token)
        .options(selectinload(CandidateInvitation.assessment))
    )
    invitation = result.scalar_one_or_none()

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invitation token",
        )

    # Check cancelled
    if invitation.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invitation has been cancelled",
        )

    # Check expired
    now = datetime.now(timezone.utc)
    if invitation.expires_at and invitation.expires_at < now:
        if invitation.status != "expired":
            invitation.status = "expired"
            await db.flush()
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invitation has expired",
        )

    if invitation.status == "expired":
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invitation has expired",
        )

    # Mark as opened (only advance forward)
    if invitation.status in ("pending", "sent"):
        invitation.status = "opened"
        invitation.opened_at = now
        await db.flush()

    assessment: Assessment = invitation.assessment

    # Count questions
    q_count_result = await db.execute(
        select(AssessmentQuestion.id).where(
            AssessmentQuestion.assessment_id == assessment.id
        )
    )
    total_questions = len(q_count_result.all())

    return TestVerifyResponse(
        invitation_id=str(invitation.id),
        assessment_id=str(assessment.id),
        assessment_title=assessment.title,
        assessment_description=assessment.description,
        assessment_instructions=assessment.instructions,
        time_limit_minutes=assessment.time_limit_minutes,
        total_questions=total_questions,
        candidate_name=invitation.candidate_name,
        candidate_email=invitation.candidate_email,
        status=invitation.status,
        proctoring_enabled=_proctoring_enabled(assessment),
        proctoring_config=assessment.proctoring_config if _proctoring_enabled(assessment) else None,
    )


# ---------------------------------------------------------------------------
# POST /test/start  — Public
# ---------------------------------------------------------------------------

@router.post("/start", response_model=TestStartResponse)
async def start_test(
    body: TestStartRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Start (or resume) a test session.

    Creates a new CandidateSession or returns an existing in-progress one.
    Returns a candidate JWT and the list of questions (without correct answers).
    """
    # Look up invitation
    result = await db.execute(
        select(CandidateInvitation)
        .where(CandidateInvitation.token == body.invitation_token)
        .options(selectinload(CandidateInvitation.assessment))
    )
    invitation = result.scalar_one_or_none()

    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invitation token",
        )

    if invitation.status in ("cancelled",):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invitation has been cancelled",
        )

    if invitation.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This test has already been completed",
        )

    now = datetime.now(timezone.utc)
    if invitation.expires_at and invitation.expires_at < now:
        if invitation.status != "expired":
            invitation.status = "expired"
            await db.flush()
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invitation has expired",
        )

    if invitation.status == "expired":
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invitation has expired",
        )

    assessment: Assessment = invitation.assessment

    # Check for existing in-progress session (resume)
    result = await db.execute(
        select(CandidateSession).where(
            CandidateSession.invitation_id == invitation.id,
            CandidateSession.status == "in_progress",
        )
    )
    session = result.scalar_one_or_none()

    # Capture IP address
    client_ip = request.client.host if request.client else None

    if session is None:
        # Check if there is already a completed/terminated session
        result = await db.execute(
            select(CandidateSession).where(
                CandidateSession.invitation_id == invitation.id,
                CandidateSession.status.in_(["completed", "terminated", "timed_out"]),
            )
        )
        finished_session = result.scalar_one_or_none()
        if finished_session:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This test has already been completed or terminated",
            )

        # Calculate time remaining
        time_remaining = None
        if assessment.time_limit_minutes:
            time_remaining = assessment.time_limit_minutes * 60

        # Create new session
        session = CandidateSession(
            assessment_id=assessment.id,
            invitation_id=invitation.id,
            organization_id=invitation.organization_id,
            candidate_email=invitation.candidate_email,
            candidate_name=invitation.candidate_name,
            status="in_progress",
            started_at=now,
            time_remaining_seconds=time_remaining,
            current_question_index=0,
            proctoring_violations=0,
            proctoring_log=[],
            ip_address=client_ip,
        )
        db.add(session)
        await db.flush()
        await db.refresh(session)
    else:
        # Update IP on resume if changed
        if client_ip and session.ip_address != client_ip:
            session.ip_address = client_ip
            await db.flush()

    # Update invitation status
    if invitation.status in ("pending", "sent", "opened"):
        invitation.status = "started"
        await db.flush()

    # Load questions
    aq_list = await _load_assessment_questions(assessment.id, db)

    # Build question DTOs
    questions = [_build_question_dto(aq) for aq in aq_list]

    # Randomize order if configured
    if assessment.is_randomized:
        random.shuffle(questions)
        # Re-assign order_index to reflect shuffled order
        for idx, q_dto in enumerate(questions):
            q_dto.order_index = idx

    # Create candidate JWT
    duration = assessment.time_limit_minutes if assessment.time_limit_minutes else 480  # 8h default
    candidate_token = create_candidate_token(
        session_id=session.id,
        assessment_id=assessment.id,
        candidate_email=invitation.candidate_email,
        duration_minutes=duration,
    )

    return TestStartResponse(
        session_id=str(session.id),
        candidate_token=candidate_token,
        time_remaining_seconds=session.time_remaining_seconds,
        questions=questions,
        proctoring_config=assessment.proctoring_config if _proctoring_enabled(assessment) else None,
    )


# ---------------------------------------------------------------------------
# GET /test/session  — Protected
# ---------------------------------------------------------------------------

@router.get("/session", response_model=SessionStateResponse)
async def get_session_state(
    session: CandidateSession = Depends(get_candidate_session),
    db: AsyncSession = Depends(get_db),
):
    """Return the current state of the candidate's session."""
    # Count total questions
    result = await db.execute(
        select(AssessmentQuestion.id).where(
            AssessmentQuestion.assessment_id == session.assessment_id
        )
    )
    total_questions = len(result.all())

    # Count answered (has at least one non-null response field)
    result = await db.execute(
        select(CandidateResponse).where(
            CandidateResponse.session_id == session.id
        )
    )
    responses = result.scalars().all()
    answered_count = sum(
        1 for r in responses
        if r.selected_option_ids or r.text_response or r.code_response
    )

    # Count flagged
    flagged_count = sum(1 for r in responses if getattr(r, "is_flagged", False))

    return SessionStateResponse(
        session_id=str(session.id),
        status=session.status,
        current_question_index=session.current_question_index,
        time_remaining_seconds=session.time_remaining_seconds,
        total_questions=total_questions,
        answered_count=answered_count,
        flagged_count=flagged_count,
        proctoring_violations=session.proctoring_violations,
    )


# ---------------------------------------------------------------------------
# POST /test/response/{question_id}  — Protected
# ---------------------------------------------------------------------------

@router.post("/response/{question_id}", response_model=ResponseSaveResponse)
async def save_response(
    question_id: UUID,
    body: ResponseSaveRequest,
    session: CandidateSession = Depends(get_candidate_session),
    db: AsyncSession = Depends(get_db),
):
    """Save or auto-save a candidate response for a question."""
    return await _upsert_response(question_id, body, session, db)


# ---------------------------------------------------------------------------
# PUT /test/response/{question_id}  — Protected
# ---------------------------------------------------------------------------

@router.put("/response/{question_id}", response_model=ResponseSaveResponse)
async def update_response(
    question_id: UUID,
    body: ResponseSaveRequest,
    session: CandidateSession = Depends(get_candidate_session),
    db: AsyncSession = Depends(get_db),
):
    """Explicitly update a candidate response for a question."""
    return await _upsert_response(question_id, body, session, db)


async def _upsert_response(
    question_id: UUID,
    body: ResponseSaveRequest,
    session: CandidateSession,
    db: AsyncSession,
) -> ResponseSaveResponse:
    """Create or update a CandidateResponse."""
    # Verify this question belongs to the session's assessment
    result = await db.execute(
        select(AssessmentQuestion).where(
            AssessmentQuestion.assessment_id == session.assessment_id,
            AssessmentQuestion.question_id == question_id,
        ).options(selectinload(AssessmentQuestion.question))
    )
    aq = result.scalar_one_or_none()
    if not aq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found in this assessment",
        )

    # Check for existing response
    result = await db.execute(
        select(CandidateResponse).where(
            CandidateResponse.session_id == session.id,
            CandidateResponse.question_id == question_id,
        )
    )
    response = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)

    if response is None:
        response = CandidateResponse(
            session_id=session.id,
            question_id=question_id,
            assessment_question_id=aq.id,
            selected_option_ids=body.selected_option_ids,
            text_response=body.text_response,
            code_response=body.code_response,
            code_language=body.code_language,
            time_spent_seconds=body.time_spent_seconds,
            is_submitted=False,
            is_flagged=body.is_flagged,
            code_snapshots=body.code_snapshots,
            max_score=aq.question.max_score if hasattr(aq, "question") and aq.question else None,
        )
        db.add(response)
    else:
        response.selected_option_ids = body.selected_option_ids
        response.text_response = body.text_response
        response.code_response = body.code_response
        response.code_language = body.code_language
        response.time_spent_seconds = body.time_spent_seconds
        response.is_flagged = body.is_flagged
        # Append code snapshots (accumulate over time)
        if body.code_snapshots:
            existing = response.code_snapshots or []
            existing.extend(body.code_snapshots)
            response.code_snapshots = existing

    await db.flush()
    await db.refresh(response)

    return ResponseSaveResponse(
        response_id=str(response.id),
        question_id=str(question_id),
        is_submitted=response.is_submitted,
        saved_at=now.isoformat(),
    )


# ---------------------------------------------------------------------------
# POST /test/navigate  — Protected
# ---------------------------------------------------------------------------

@router.post("/navigate", status_code=status.HTTP_200_OK)
async def navigate(
    body: NavigationRequest,
    session: CandidateSession = Depends(get_candidate_session),
    db: AsyncSession = Depends(get_db),
):
    """Update the candidate's current question index."""
    session.current_question_index = body.question_index
    await db.flush()
    return {"current_question_index": session.current_question_index}


# ---------------------------------------------------------------------------
# POST /test/submit  — Protected
# ---------------------------------------------------------------------------

@router.post("/submit", response_model=TestSubmitResponse)
async def submit_test(
    session: CandidateSession = Depends(get_candidate_session),
    db: AsyncSession = Depends(get_db),
):
    """Submit the test.

    Marks all responses as submitted, auto-scores MCQ/multi_select questions,
    calculates totals, and finalizes the session.
    """
    now = datetime.now(timezone.utc)

    # Load all responses for this session
    result = await db.execute(
        select(CandidateResponse).where(
            CandidateResponse.session_id == session.id
        )
    )
    responses = result.scalars().all()

    # Mark all responses as submitted and auto-score
    for resp in responses:
        if not resp.is_submitted:
            resp.is_submitted = True
            resp.submitted_at = now

        # Load the question with options and test cases for scoring
        q_result = await db.execute(
            select(Question)
            .where(Question.id == resp.question_id)
            .options(
                selectinload(Question.options),
                selectinload(Question.test_cases),
            )
        )
        question = q_result.scalar_one_or_none()

        if question:
            resp.max_score = question.max_score

            # Run sandbox for coding questions
            q_type = question.type.value if hasattr(question.type, "value") else question.type
            if q_type in ("coding", "debugging", "code_completion") and resp.code_response and resp.code_language:
                try:
                    tc_dicts = [
                        {
                            "id": str(tc.id),
                            "input": tc.input or "",
                            "expected_output": tc.expected_output or "",
                        }
                        for tc in question.test_cases
                    ]
                    if tc_dicts:
                        tc_results = await sandbox_executor.run_test_cases(
                            code=resp.code_response,
                            language=resp.code_language,
                            test_cases=tc_dicts,
                            timeout_ms=question.test_cases[0].time_limit_ms if question.test_cases else 5000,
                            memory_limit_mb=question.test_cases[0].memory_limit_mb if question.test_cases else 256,
                        )
                        resp.code_execution_results = {
                            "results": [
                                {
                                    "test_case_id": r.test_case_id,
                                    "input": r.input,
                                    "expected_output": r.expected_output,
                                    "actual_output": r.actual_output,
                                    "passed": r.passed,
                                    "execution_time_ms": r.execution_time_ms,
                                    "error": r.error,
                                }
                                for r in tc_results
                            ],
                            "total": len(tc_results),
                            "passed": sum(1 for r in tc_results if r.passed),
                        }
                        # Auto-score coding: proportion of test cases passed
                        passed_count = sum(1 for r in tc_results if r.passed)
                        if len(tc_results) > 0:
                            resp.auto_score = round(
                                (passed_count / len(tc_results)) * question.max_score, 2
                            )
                            if resp.final_score is None:
                                resp.final_score = resp.auto_score
                except Exception:
                    pass  # Sandbox failures shouldn't block submission

            # Auto-score non-coding questions
            if resp.auto_score is None:
                score = await auto_score_response(resp, question, db)
                if score is not None:
                    resp.auto_score = score
                    if resp.final_score is None:
                        resp.final_score = score

    await db.flush()

    # Calculate session totals
    totals = await calculate_session_totals(session.id, db)

    # Update session
    session.status = "completed"
    session.completed_at = now
    session.total_score = totals["total_score"]
    session.total_max_score = totals["total_max_score"]
    session.score_pct = totals["score_pct"]

    # Determine pass/fail
    result = await db.execute(
        select(Assessment).where(Assessment.id == session.assessment_id)
    )
    assessment = result.scalar_one_or_none()

    show_score = False
    if assessment:
        if totals["score_pct"] is not None:
            session.is_passed = totals["score_pct"] >= assessment.passing_score_pct
        show_score = assessment.show_score_immediately

    # Update invitation status
    result = await db.execute(
        select(CandidateInvitation).where(
            CandidateInvitation.id == session.invitation_id
        )
    )
    invitation = result.scalar_one_or_none()
    if invitation:
        invitation.status = "completed"

    await db.flush()

    return TestSubmitResponse(
        session_id=str(session.id),
        status=session.status,
        total_score=session.total_score if show_score else None,
        total_max_score=session.total_max_score if show_score else None,
        score_pct=session.score_pct if show_score else None,
        is_passed=session.is_passed if show_score else None,
        show_score=show_score,
        message="Test submitted successfully",
    )


# ---------------------------------------------------------------------------
# GET /test/complete  — Protected
# ---------------------------------------------------------------------------

@router.get("/complete", response_model=CompletionResponse)
async def get_completion(
    session: CandidateSession = Depends(get_candidate_session_any_status),
    db: AsyncSession = Depends(get_db),
):
    """Return completion screen data for a finished test."""
    result = await db.execute(
        select(Assessment).where(Assessment.id == session.assessment_id)
    )
    assessment = result.scalar_one_or_none()
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found",
        )

    show_score = assessment.show_score_immediately

    return CompletionResponse(
        session_id=str(session.id),
        candidate_name=session.candidate_name,
        assessment_title=assessment.title,
        status=session.status,
        total_score=session.total_score if show_score else None,
        total_max_score=session.total_max_score if show_score else None,
        score_pct=session.score_pct if show_score else None,
        is_passed=session.is_passed if show_score else None,
        show_score=show_score,
        completed_at=session.completed_at.isoformat() if session.completed_at else None,
    )


# ---------------------------------------------------------------------------
# POST /test/proctoring/violation  — Protected
# ---------------------------------------------------------------------------

@router.post("/proctoring/violation", response_model=ProctoringStatusResponse)
async def report_violation(
    body: ProctoringViolationRequest,
    session: CandidateSession = Depends(get_candidate_session),
    db: AsyncSession = Depends(get_db),
):
    """Log a proctoring violation.

    Appends to the session's proctoring_log and increments the violation counter.
    If violations reach the maximum threshold, the session is terminated.
    """
    now = datetime.now(timezone.utc)

    # Append to proctoring log
    log_entry = {
        "type": body.violation_type,
        "details": body.details,
        "timestamp": body.timestamp or now.isoformat(),
        "recorded_at": now.isoformat(),
    }

    current_log = session.proctoring_log if session.proctoring_log else []
    current_log.append(log_entry)
    session.proctoring_log = current_log

    # Increment violation count
    session.proctoring_violations = (session.proctoring_violations or 0) + 1

    # Determine max violations from assessment config
    result = await db.execute(
        select(Assessment).where(Assessment.id == session.assessment_id)
    )
    assessment = result.scalar_one_or_none()
    max_violations = _get_max_violations(assessment) if assessment else DEFAULT_MAX_VIOLATIONS

    is_terminated = False
    if session.proctoring_violations >= max_violations:
        session.status = "terminated"
        session.completed_at = now
        is_terminated = True

        # Also update invitation
        result = await db.execute(
            select(CandidateInvitation).where(
                CandidateInvitation.id == session.invitation_id
            )
        )
        invitation = result.scalar_one_or_none()
        if invitation:
            invitation.status = "completed"

    await db.flush()

    warnings_remaining = max(0, max_violations - session.proctoring_violations)

    return ProctoringStatusResponse(
        violations=session.proctoring_violations,
        max_violations=max_violations,
        warnings_remaining=warnings_remaining,
        is_terminated=is_terminated,
    )


# ---------------------------------------------------------------------------
# GET /test/proctoring/status  — Protected
# ---------------------------------------------------------------------------

@router.get("/proctoring/status", response_model=ProctoringStatusResponse)
async def get_proctoring_status(
    session: CandidateSession = Depends(get_candidate_session),
    db: AsyncSession = Depends(get_db),
):
    """Return the current proctoring violation count and warnings remaining."""
    result = await db.execute(
        select(Assessment).where(Assessment.id == session.assessment_id)
    )
    assessment = result.scalar_one_or_none()
    max_violations = _get_max_violations(assessment) if assessment else DEFAULT_MAX_VIOLATIONS

    violations = session.proctoring_violations or 0
    warnings_remaining = max(0, max_violations - violations)

    return ProctoringStatusResponse(
        violations=violations,
        max_violations=max_violations,
        warnings_remaining=warnings_remaining,
        is_terminated=session.status == "terminated",
    )


# ---------------------------------------------------------------------------
# GET /test/adaptive/next  — Protected
# ---------------------------------------------------------------------------

@router.get("/adaptive/next")
async def get_next_adaptive_question(
    session: CandidateSession = Depends(get_candidate_session),
    db: AsyncSession = Depends(get_db),
):
    """For adaptive assessments: select the next question based on performance.

    Uses IRT-simplified adaptive engine to pick appropriate difficulty.
    Returns a single question DTO, or null if all questions answered.
    """
    # Check assessment is adaptive
    result = await db.execute(
        select(Assessment).where(Assessment.id == session.assessment_id)
    )
    assessment = result.scalar_one_or_none()
    if not assessment or not assessment.is_adaptive:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This assessment is not configured for adaptive testing",
        )

    # Load all assessment questions
    aq_list = await _load_assessment_questions(assessment.id, db)

    # Get answered question IDs and build performance tracker
    result = await db.execute(
        select(CandidateResponse).where(CandidateResponse.session_id == session.id)
    )
    responses = result.scalars().all()
    answered_ids = set()
    tracker = PerformanceTracker()

    for resp in responses:
        answered_ids.add(str(resp.question_id))
        # Determine if correct based on auto_score
        if resp.auto_score is not None and resp.max_score:
            is_correct = resp.auto_score >= (resp.max_score * 0.5)
        else:
            is_correct = False  # Conservative default
        tracker.record_answer(is_correct)

    # Build available question pool
    available = []
    for aq in aq_list:
        q = aq.question
        q_diff = q.difficulty.value if hasattr(q.difficulty, "value") else q.difficulty
        available.append({
            "id": str(q.id),
            "difficulty": q_diff,
            "aq": aq,
        })

    # Select next question
    selected = select_next_question(tracker, available, answered_ids)

    if not selected:
        return {
            "question": None,
            "remaining": 0,
            "performance": {
                "accuracy": tracker.accuracy,
                "current_difficulty": tracker.current_difficulty,
                "answered": tracker.total_answered,
            },
        }

    aq = selected["aq"]
    question_dto = _build_question_dto(aq)

    return {
        "question": question_dto,
        "remaining": len(available) - len(answered_ids) - 1,
        "performance": {
            "accuracy": tracker.accuracy,
            "current_difficulty": tracker.current_difficulty,
            "answered": tracker.total_answered,
        },
    }
