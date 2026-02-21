import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.permissions import is_super_admin, require_roles, same_org
from app.db.session import get_db
from app.models.assessment import Assessment, AssessmentQuestion, AssessmentSection
from app.models.question import Question
from app.models.user import User
from app.schemas.assessment import (
    AssessmentCreate,
    AssessmentDetailResponse,
    AssessmentListResponse,
    AssessmentQuestionAdd,
    AssessmentQuestionResponse,
    AssessmentQuestionUpdate,
    AssessmentResponse,
    AssessmentSectionCreate,
    AssessmentSectionResponse,
    AssessmentSectionUpdate,
    AssessmentUpdate,
    ReorderItem,
)

router = APIRouter()


def _assessment_detail_query():
    return select(Assessment).options(
        selectinload(Assessment.sections),
        selectinload(Assessment.assessment_questions).selectinload(
            AssessmentQuestion.question
        ).selectinload(Question.options),
        selectinload(Assessment.assessment_questions).selectinload(
            AssessmentQuestion.question
        ).selectinload(Question.test_cases),
        selectinload(Assessment.assessment_questions).selectinload(
            AssessmentQuestion.question
        ).selectinload(Question.code_stubs),
        selectinload(Assessment.assessment_questions).selectinload(
            AssessmentQuestion.question
        ).selectinload(Question.tags),
    )


@router.get("/", response_model=AssessmentListResponse)
async def list_assessments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    assessment_status: str | None = None,
    search: str | None = None,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    query = select(Assessment).where(Assessment.is_active == True)

    # Non-super_admin sees only their own org
    if not is_super_admin(current_user) and current_user.organization_id:
        query = query.where(Assessment.organization_id == current_user.organization_id)

    if assessment_status:
        query = query.where(Assessment.status == assessment_status)
    if search:
        query = query.where(Assessment.title.ilike(f"%{search}%"))

    # Count
    base_filter = select(Assessment.id).where(Assessment.is_active == True)
    if not is_super_admin(current_user) and current_user.organization_id:
        base_filter = base_filter.where(Assessment.organization_id == current_user.organization_id)
    if assessment_status:
        base_filter = base_filter.where(Assessment.status == assessment_status)
    if search:
        base_filter = base_filter.where(Assessment.title.ilike(f"%{search}%"))
    total = (await db.execute(select(func.count()).select_from(base_filter.subquery()))).scalar() or 0

    query = query.order_by(Assessment.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    assessments = result.scalars().all()

    return AssessmentListResponse(
        assessments=[AssessmentResponse.model_validate(a) for a in assessments],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/", response_model=AssessmentResponse, status_code=status.HTTP_201_CREATED)
async def create_assessment(
    request: AssessmentCreate,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="User must belong to an organization")

    assessment = Assessment(
        organization_id=current_user.organization_id,
        created_by_id=current_user.id,
        **request.model_dump(),
    )
    db.add(assessment)
    await db.flush()
    await db.refresh(assessment)
    return AssessmentResponse.model_validate(assessment)


@router.get("/{assessment_id}", response_model=AssessmentDetailResponse)
async def get_assessment(
    assessment_id: UUID,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        _assessment_detail_query().where(Assessment.id == assessment_id)
    )
    assessment = result.unique().scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    if not same_org(current_user, assessment.organization_id):
        raise HTTPException(status_code=403, detail="Access denied")

    return AssessmentDetailResponse.model_validate(assessment)


@router.put("/{assessment_id}", response_model=AssessmentResponse)
async def update_assessment(
    assessment_id: UUID,
    request: AssessmentUpdate,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Assessment).where(Assessment.id == assessment_id))
    assessment = result.scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    if not same_org(current_user, assessment.organization_id):
        raise HTTPException(status_code=403, detail="Access denied")

    for field, value in request.model_dump(exclude_unset=True).items():
        setattr(assessment, field, value)

    await db.flush()
    await db.refresh(assessment)
    return AssessmentResponse.model_validate(assessment)


@router.delete("/{assessment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_assessment(
    assessment_id: UUID,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Assessment).where(Assessment.id == assessment_id))
    assessment = result.scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    if not same_org(current_user, assessment.organization_id):
        raise HTTPException(status_code=403, detail="Access denied")

    assessment.is_active = False
    await db.flush()


@router.post("/{assessment_id}/publish", response_model=AssessmentResponse)
async def publish_assessment(
    assessment_id: UUID,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Assessment).where(Assessment.id == assessment_id))
    assessment = result.scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    if assessment.status not in ("draft",):
        raise HTTPException(status_code=400, detail=f"Cannot publish from status '{assessment.status}'")

    assessment.status = "published"
    await db.flush()
    await db.refresh(assessment)
    return AssessmentResponse.model_validate(assessment)


@router.post("/{assessment_id}/close", response_model=AssessmentResponse)
async def close_assessment(
    assessment_id: UUID,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Assessment).where(Assessment.id == assessment_id))
    assessment = result.scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    if assessment.status not in ("published", "active"):
        raise HTTPException(status_code=400, detail=f"Cannot close from status '{assessment.status}'")

    assessment.status = "closed"
    await db.flush()
    await db.refresh(assessment)
    return AssessmentResponse.model_validate(assessment)


# --- Sections ---

@router.post("/{assessment_id}/sections", response_model=AssessmentSectionResponse, status_code=status.HTTP_201_CREATED)
async def add_section(
    assessment_id: UUID,
    request: AssessmentSectionCreate,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Assessment).where(Assessment.id == assessment_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Assessment not found")

    section = AssessmentSection(assessment_id=assessment_id, **request.model_dump())
    db.add(section)
    await db.flush()
    await db.refresh(section)
    return AssessmentSectionResponse.model_validate(section)


@router.put("/{assessment_id}/sections/{section_id}", response_model=AssessmentSectionResponse)
async def update_section(
    assessment_id: UUID,
    section_id: UUID,
    request: AssessmentSectionUpdate,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AssessmentSection).where(
            AssessmentSection.id == section_id,
            AssessmentSection.assessment_id == assessment_id,
        )
    )
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    for field, value in request.model_dump(exclude_unset=True).items():
        setattr(section, field, value)

    await db.flush()
    await db.refresh(section)
    return AssessmentSectionResponse.model_validate(section)


@router.delete("/{assessment_id}/sections/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_section(
    assessment_id: UUID,
    section_id: UUID,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AssessmentSection).where(
            AssessmentSection.id == section_id,
            AssessmentSection.assessment_id == assessment_id,
        )
    )
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    await db.delete(section)
    await db.flush()


# --- Assessment Questions ---

@router.post("/{assessment_id}/questions", response_model=AssessmentQuestionResponse, status_code=status.HTTP_201_CREATED)
async def add_question_to_assessment(
    assessment_id: UUID,
    request: AssessmentQuestionAdd,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    # Verify assessment exists
    result = await db.execute(select(Assessment).where(Assessment.id == assessment_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Verify question exists
    result = await db.execute(select(Question).where(Question.id == request.question_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Question not found")

    # Check duplicate
    result = await db.execute(
        select(AssessmentQuestion).where(
            AssessmentQuestion.assessment_id == assessment_id,
            AssessmentQuestion.question_id == request.question_id,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Question already added to this assessment")

    aq = AssessmentQuestion(
        assessment_id=assessment_id,
        question_id=request.question_id,
        section_id=request.section_id,
        order_index=request.order_index,
        weight=request.weight,
        is_required=request.is_required,
    )
    db.add(aq)
    await db.flush()

    # Reload with question relationship
    result = await db.execute(
        select(AssessmentQuestion)
        .options(
            selectinload(AssessmentQuestion.question).selectinload(Question.options),
            selectinload(AssessmentQuestion.question).selectinload(Question.test_cases),
            selectinload(AssessmentQuestion.question).selectinload(Question.code_stubs),
            selectinload(AssessmentQuestion.question).selectinload(Question.tags),
        )
        .where(AssessmentQuestion.id == aq.id)
    )
    aq = result.unique().scalar_one()
    return AssessmentQuestionResponse.model_validate(aq)


@router.put("/{assessment_id}/questions/{aq_id}", response_model=AssessmentQuestionResponse)
async def update_assessment_question(
    assessment_id: UUID,
    aq_id: UUID,
    request: AssessmentQuestionUpdate,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AssessmentQuestion).where(
            AssessmentQuestion.id == aq_id,
            AssessmentQuestion.assessment_id == assessment_id,
        )
    )
    aq = result.scalar_one_or_none()
    if not aq:
        raise HTTPException(status_code=404, detail="Assessment question not found")

    for field, value in request.model_dump(exclude_unset=True).items():
        setattr(aq, field, value)

    await db.flush()

    result = await db.execute(
        select(AssessmentQuestion)
        .options(
            selectinload(AssessmentQuestion.question).selectinload(Question.options),
            selectinload(AssessmentQuestion.question).selectinload(Question.test_cases),
            selectinload(AssessmentQuestion.question).selectinload(Question.code_stubs),
            selectinload(AssessmentQuestion.question).selectinload(Question.tags),
        )
        .where(AssessmentQuestion.id == aq.id)
    )
    aq = result.unique().scalar_one()
    return AssessmentQuestionResponse.model_validate(aq)


@router.delete("/{assessment_id}/questions/{aq_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_question_from_assessment(
    assessment_id: UUID,
    aq_id: UUID,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AssessmentQuestion).where(
            AssessmentQuestion.id == aq_id,
            AssessmentQuestion.assessment_id == assessment_id,
        )
    )
    aq = result.scalar_one_or_none()
    if not aq:
        raise HTTPException(status_code=404, detail="Assessment question not found")
    await db.delete(aq)
    await db.flush()


@router.post("/{assessment_id}/questions/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_questions(
    assessment_id: UUID,
    items: list[ReorderItem],
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    for item in items:
        result = await db.execute(
            select(AssessmentQuestion).where(
                AssessmentQuestion.id == item.id,
                AssessmentQuestion.assessment_id == assessment_id,
            )
        )
        aq = result.scalar_one_or_none()
        if aq:
            aq.order_index = item.order_index
    await db.flush()


# ---------------------------------------------------------------------------
# POST /assessments/ai-build  — Build assessment from JD using AI
# ---------------------------------------------------------------------------

@router.post("/ai-build")
async def ai_build_assessment(
    body: dict,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    """Build an assessment from a job description using AI.

    Body: {"job_description": "...", "question_count": 20, "time_limit": 60, "difficulty_mix": {...}}
    """
    from app.ai.agents.assessment_builder import AssessmentBuilderAgent
    from app.models.taxonomy import Skill, Technology

    job_description = body.get("job_description", "")
    if not job_description:
        raise HTTPException(status_code=400, detail="Job description is required")

    question_count = body.get("question_count", 20)
    time_limit = body.get("time_limit", 60)
    difficulty_mix = body.get("difficulty_mix")

    # Get available skills from taxonomy
    tech_result = await db.execute(select(Technology).where(Technology.is_active == True))
    technologies = tech_result.scalars().all()

    available_skills = []
    for tech in technologies:
        skills_result = await db.execute(
            select(Skill).where(Skill.technology_id == tech.id, Skill.is_active == True)
        )
        skills = skills_result.scalars().all()
        available_skills.append({
            "technology": tech.name,
            "skills": [s.name for s in skills],
        })

    agent = AssessmentBuilderAgent()
    blueprint = await agent.build(
        job_description=job_description,
        available_skills=available_skills,
        question_count=question_count,
        time_limit=time_limit,
        difficulty_mix=difficulty_mix,
    )

    return {
        "blueprint": blueprint,
        "jd_analysis": blueprint.get("jd_analysis", {}),
        "generated_questions": blueprint.get("generated_questions", []),
    }


# ---------------------------------------------------------------------------
# POST /assessments/{assessment_id}/ai-evaluate  — AI evaluate a session
# ---------------------------------------------------------------------------

@router.post("/{assessment_id}/ai-evaluate")
async def ai_evaluate_session(
    assessment_id: UUID,
    body: dict,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    """Run AI evaluation on a completed session.

    Body: {"session_id": "uuid"}
    """
    from app.ai.agents.evaluation import EvaluationAgent
    from app.ai.agents.proctoring import ProctoringAnalyzerAgent
    from app.models.candidate import CandidateSession
    from app.models.response import CandidateResponse
    from app.models.question import Question

    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    # Load session
    session_result = await db.execute(
        select(CandidateSession).where(CandidateSession.id == session_id)
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Load responses
    resp_result = await db.execute(
        select(CandidateResponse).where(CandidateResponse.session_id == session.id)
    )
    responses = resp_result.scalars().all()

    eval_agent = EvaluationAgent()
    ai_evaluations = {}

    for resp in responses:
        q_result = await db.execute(
            select(Question).where(Question.id == resp.question_id)
        )
        question = q_result.scalar_one_or_none()
        if not question:
            continue

        q_type = question.type.value if hasattr(question.type, "value") else question.type
        if q_type in ("mcq", "multi_select"):
            continue

        response_text = resp.code_response or resp.text_response or ""
        if not response_text:
            continue

        try:
            evaluation = await eval_agent.evaluate_response(
                question_type=q_type,
                question_title=question.title,
                question_body=question.body,
                response_text=response_text,
                max_score=question.max_score,
                code_execution_results=resp.code_execution_results,
            )
            ai_evaluations[str(resp.question_id)] = evaluation

            # Update response with AI score
            resp.ai_score = evaluation.get("score")
            resp.evaluation_feedback = evaluation.get("feedback")
            resp.evaluation_metadata = evaluation
            if resp.final_score is None and resp.ai_score is not None:
                resp.final_score = resp.ai_score
        except Exception:
            pass

    # Proctoring analysis
    proctoring_report = {}
    if session.proctoring_log:
        try:
            proctor_agent = ProctoringAnalyzerAgent()
            duration = 0
            if session.started_at and session.completed_at:
                duration = (session.completed_at - session.started_at).total_seconds() / 60

            response_timing = []
            for resp in responses:
                q_result = await db.execute(
                    select(Question).where(Question.id == resp.question_id)
                )
                q = q_result.scalar_one_or_none()
                if q:
                    response_timing.append({
                        "question_title": q.title,
                        "time_spent_seconds": resp.time_spent_seconds or 0,
                    })

            proctoring_report = await proctor_agent.analyze_session(
                duration_minutes=duration,
                total_violations=session.proctoring_violations or 0,
                max_violations=5,
                violation_log=session.proctoring_log or [],
                response_timing=response_timing,
            )
        except Exception:
            proctoring_report = {"risk_level": "unknown", "summary": "Analysis unavailable"}

    await db.flush()

    # Recalculate totals
    from app.services.scoring import calculate_session_totals
    totals = await calculate_session_totals(session.id, db)
    session.total_score = totals["total_score"]
    session.total_max_score = totals["total_max_score"]
    session.score_pct = totals["score_pct"]
    await db.flush()

    return {
        "session_id": str(session.id),
        "ai_evaluations": ai_evaluations,
        "proctoring_report": proctoring_report,
        "total_score": totals["total_score"],
        "total_max_score": totals["total_max_score"],
        "score_pct": totals["score_pct"],
    }


# ---------------------------------------------------------------------------
# POST /assessments/{assessment_id}/plagiarism-check
# ---------------------------------------------------------------------------

@router.post("/{assessment_id}/plagiarism-check")
async def check_plagiarism(
    assessment_id: UUID,
    user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    """Run plagiarism detection across all code submissions for an assessment."""
    from app.models.candidate import CandidateSession
    from app.models.response import CandidateResponse
    from app.services.plagiarism import check_plagiarism_for_question

    # Load completed sessions
    result = await db.execute(
        select(CandidateSession).where(
            CandidateSession.assessment_id == assessment_id,
            CandidateSession.status == "completed",
        )
    )
    sessions = result.scalars().all()
    session_ids = {s.id for s in sessions}

    if len(session_ids) < 2:
        return {"flagged_pairs": [], "message": "Need at least 2 completed sessions"}

    # Load code responses grouped by question
    result = await db.execute(
        select(CandidateResponse).where(
            CandidateResponse.session_id.in_(session_ids),
            CandidateResponse.code_response.isnot(None),
            CandidateResponse.is_submitted == True,
        )
    )
    responses = result.scalars().all()

    # Group by question_id
    question_groups: dict[str, list[dict]] = {}
    for resp in responses:
        q_id = str(resp.question_id)
        if q_id not in question_groups:
            question_groups[q_id] = []
        question_groups[q_id].append({
            "session_id": str(resp.session_id),
            "code": resp.code_response,
            "language": resp.code_language or "python",
        })

    all_flagged = []
    for q_id, subs in question_groups.items():
        if len(subs) < 2:
            continue
        language = subs[0]["language"]
        flagged = await check_plagiarism_for_question(q_id, subs, language)
        for f in flagged:
            all_flagged.append({
                "question_id": f.question_id,
                "session_a": f.session_a_id,
                "session_b": f.session_b_id,
                "token_similarity": f.token_similarity,
                "normalized_similarity": f.normalized_similarity,
                "combined_score": f.combined_score,
            })

    return {
        "assessment_id": str(assessment_id),
        "total_sessions": len(session_ids),
        "questions_checked": len(question_groups),
        "flagged_pairs": all_flagged,
    }
