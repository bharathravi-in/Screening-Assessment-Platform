import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.permissions import is_super_admin, require_roles
from app.db.session import get_db
from app.models.question import (
    Question,
    QuestionCodeStub,
    QuestionOption,
    QuestionTag,
    QuestionTestCase,
)
from app.models.user import User, UserRole
logger = logging.getLogger(__name__)
from app.schemas.question import (
    QuestionCodeStubCreate,
    QuestionCodeStubResponse,
    QuestionCreate,
    QuestionListResponse,
    QuestionOptionCreate,
    QuestionOptionResponse,
    QuestionResponse,
    QuestionTestCaseCreate,
    QuestionTestCaseResponse,
    QuestionUpdate,
)

router = APIRouter()


def _question_query():
    """Base query with eager loading."""
    return select(Question).options(
        selectinload(Question.options),
        selectinload(Question.test_cases),
        selectinload(Question.code_stubs),
        selectinload(Question.tags),
    )


def _apply_tech_skill_filter(query, user: User):
    """Apply skill scoping for tech role users (limits to their allowed_skill_ids)."""
    if user.role == UserRole.TECH and user.allowed_skill_ids:
        skill_uuids = [UUID(s) for s in user.allowed_skill_ids if s]
        if skill_uuids:
            query = query.where(Question.tags.any(QuestionTag.skill_id.in_(skill_uuids)))
    return query


@router.get("/", response_model=QuestionListResponse)
async def list_questions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    type: str | None = None,
    difficulty: str | None = None,
    skill_id: UUID | None = None,
    search: str | None = None,
    is_active: bool | None = True,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    query = _question_query()
    # Tech users are scoped to their allowed skills
    query = _apply_tech_skill_filter(query, current_user)

    if is_active is not None:
        query = query.where(Question.is_active == is_active)
    if type:
        query = query.where(Question.type == type)
    if difficulty:
        query = query.where(Question.difficulty == difficulty)
    if search:
        query = query.where(Question.title.ilike(f"%{search}%"))
    if skill_id:
        query = query.where(Question.tags.any(QuestionTag.skill_id == skill_id))

    # Count
    count_q = select(func.count()).select_from(
        select(Question.id).where(Question.is_active == (is_active if is_active is not None else True))
    )
    if type:
        count_q = select(func.count()).select_from(
            select(Question.id).where(Question.is_active == True, Question.type == type)
        )

    # Simplified count: just count the base filtered query
    base_filter = select(Question.id)
    if is_active is not None:
        base_filter = base_filter.where(Question.is_active == is_active)
    if type:
        base_filter = base_filter.where(Question.type == type)
    if difficulty:
        base_filter = base_filter.where(Question.difficulty == difficulty)
    if search:
        base_filter = base_filter.where(Question.title.ilike(f"%{search}%"))
    if skill_id:
        base_filter = base_filter.where(Question.tags.any(QuestionTag.skill_id == skill_id))

    total = (await db.execute(select(func.count()).select_from(base_filter.subquery()))).scalar() or 0

    # Paginate
    query = query.order_by(Question.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    questions = result.unique().scalars().all()

    return QuestionListResponse(
        questions=[QuestionResponse.model_validate(q) for q in questions],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
async def create_question(
    request: QuestionCreate,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    question = Question(
        organization_id=current_user.organization_id,
        created_by_id=current_user.id,
        type=request.type,
        difficulty=request.difficulty,
        title=request.title,
        body=request.body,
        explanation=request.explanation,
        time_limit_seconds=request.time_limit_seconds,
        max_score=request.max_score,
    )
    db.add(question)
    await db.flush()

    # Add options
    if request.options:
        for opt in request.options:
            db.add(QuestionOption(
                question_id=question.id,
                label=opt.label,
                text=opt.text,
                is_correct=opt.is_correct,
                order_index=opt.order_index,
            ))

    # Add test cases
    if request.test_cases:
        for tc in request.test_cases:
            db.add(QuestionTestCase(
                question_id=question.id,
                input=tc.input,
                expected_output=tc.expected_output,
                is_hidden=tc.is_hidden,
                is_sample=tc.is_sample,
                order_index=tc.order_index,
                time_limit_ms=tc.time_limit_ms,
                memory_limit_mb=tc.memory_limit_mb,
            ))

    # Add code stubs
    if request.code_stubs:
        for cs in request.code_stubs:
            db.add(QuestionCodeStub(
                question_id=question.id,
                language=cs.language,
                stub_code=cs.stub_code,
                solution_code=cs.solution_code,
            ))

    # Add tags
    if request.skill_ids:
        for sid in request.skill_ids:
            db.add(QuestionTag(question_id=question.id, skill_id=sid))

    await db.flush()

    # Reload with relationships
    result = await db.execute(_question_query().where(Question.id == question.id))
    q = result.unique().scalar_one()
    return QuestionResponse.model_validate(q)


@router.get("/{question_id}", response_model=QuestionResponse)
async def get_question(
    question_id: UUID,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(_question_query().where(Question.id == question_id))
    question = result.unique().scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    # Tech users can only view questions in their skill scope
    query = _apply_tech_skill_filter(
        _question_query().where(Question.id == question_id), current_user
    )
    result = await db.execute(query)
    question = result.unique().scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=403, detail="Question not in your skill scope")
    return QuestionResponse.model_validate(question)


@router.put("/{question_id}", response_model=QuestionResponse)
async def update_question(
    question_id: UUID,
    request: QuestionUpdate,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Question).where(Question.id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    # Tech users can only edit questions they created
    if current_user.role == UserRole.TECH and str(question.created_by_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="You can only edit questions you created")

    for field, value in request.model_dump(exclude_unset=True).items():
        setattr(question, field, value)

    await db.flush()

    # Reload with relationships
    result = await db.execute(_question_query().where(Question.id == question_id))
    q = result.unique().scalar_one()
    return QuestionResponse.model_validate(q)


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    question_id: UUID,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Question).where(Question.id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    question.is_active = False
    await db.flush()


@router.post("/{question_id}/options", response_model=list[QuestionOptionResponse])
async def replace_options(
    question_id: UUID,
    options: list[QuestionOptionCreate],
    current_user: User = Depends(require_roles("admin", "hr")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Question).where(Question.id == question_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Question not found")

    # Delete existing
    existing = await db.execute(select(QuestionOption).where(QuestionOption.question_id == question_id))
    for opt in existing.scalars().all():
        await db.delete(opt)

    # Create new
    new_options = []
    for opt in options:
        o = QuestionOption(
            question_id=question_id,
            label=opt.label,
            text=opt.text,
            is_correct=opt.is_correct,
            order_index=opt.order_index,
        )
        db.add(o)
        new_options.append(o)

    await db.flush()
    for o in new_options:
        await db.refresh(o)
    return [QuestionOptionResponse.model_validate(o) for o in new_options]


@router.post("/{question_id}/test-cases", response_model=list[QuestionTestCaseResponse])
async def replace_test_cases(
    question_id: UUID,
    test_cases: list[QuestionTestCaseCreate],
    current_user: User = Depends(require_roles("admin", "hr")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Question).where(Question.id == question_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Question not found")

    existing = await db.execute(select(QuestionTestCase).where(QuestionTestCase.question_id == question_id))
    for tc in existing.scalars().all():
        await db.delete(tc)

    new_cases = []
    for tc in test_cases:
        t = QuestionTestCase(
            question_id=question_id,
            input=tc.input,
            expected_output=tc.expected_output,
            is_hidden=tc.is_hidden,
            is_sample=tc.is_sample,
            order_index=tc.order_index,
            time_limit_ms=tc.time_limit_ms,
            memory_limit_mb=tc.memory_limit_mb,
        )
        db.add(t)
        new_cases.append(t)

    await db.flush()
    for t in new_cases:
        await db.refresh(t)
    return [QuestionTestCaseResponse.model_validate(t) for t in new_cases]


@router.post("/{question_id}/code-stubs", response_model=list[QuestionCodeStubResponse])
async def replace_code_stubs(
    question_id: UUID,
    code_stubs: list[QuestionCodeStubCreate],
    current_user: User = Depends(require_roles("admin", "hr")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Question).where(Question.id == question_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Question not found")

    existing = await db.execute(select(QuestionCodeStub).where(QuestionCodeStub.question_id == question_id))
    for cs in existing.scalars().all():
        await db.delete(cs)

    new_stubs = []
    for cs in code_stubs:
        s = QuestionCodeStub(
            question_id=question_id,
            language=cs.language,
            stub_code=cs.stub_code,
            solution_code=cs.solution_code,
        )
        db.add(s)
        new_stubs.append(s)

    await db.flush()
    for s in new_stubs:
        await db.refresh(s)
    return [QuestionCodeStubResponse.model_validate(s) for s in new_stubs]


# ---------------------------------------------------------------------------
# POST /questions/ai-generate  — Generate questions using AI
# ---------------------------------------------------------------------------

@router.post("/ai-generate")
async def ai_generate_questions(
    body: dict,
    current_user: User = Depends(require_roles("admin", "hr")),
):
    """Generate questions using AI.

    Body: {"skills": [...], "difficulty": "...", "question_type": "...", "count": N}
    """
    from app.ai.agents.question_generator import QuestionGeneratorAgent

    skills = body.get("skills", [])
    difficulty = body.get("difficulty", "intermediate")
    question_type = body.get("question_type", "mcq")
    count = min(body.get("count", 1), 10)

    if not skills:
        raise HTTPException(status_code=400, detail="At least one skill is required")

    agent = QuestionGeneratorAgent()
    questions = await agent.generate(
        skills=skills,
        difficulty=difficulty,
        question_type=question_type,
        count=count,
    )

    return {"questions": questions, "count": len(questions)}


# ---------------------------------------------------------------------------
# POST /questions/ai-generate-and-save  — Generate & persist to question bank
# ---------------------------------------------------------------------------

@router.post("/ai-generate-and-save")
async def ai_generate_and_save_questions(
    body: dict,
    current_user: User = Depends(require_roles("admin", "hr")),
    db: AsyncSession = Depends(get_db),
):
    """Generate questions via AI AND save them to the question bank.

    Body: {"skills": [...], "difficulty": "...", "question_type": "...", "count": N}

    Returns saved question IDs for immediate use in assessments.
    """
    from app.ai.agents.question_generator import QuestionGeneratorAgent

    skills = body.get("skills", [])
    difficulty = body.get("difficulty", "intermediate")
    question_type = body.get("question_type", "mcq")
    count = min(body.get("count", 1), 10)

    if not skills:
        raise HTTPException(status_code=400, detail="At least one skill is required")

    agent = QuestionGeneratorAgent()
    try:
        questions = await agent.generate(
            skills=skills,
            difficulty=difficulty,
            question_type=question_type,
            count=count,
        )
    except Exception as e:
        logger.error("AI question generation failed: %s", e)
        raise HTTPException(
            status_code=502,
            detail=f"AI provider connection failed: {type(e).__name__}. Please try again.",
        )

    saved_questions = []
    for q_data in questions:
        question = Question(
            organization_id=current_user.organization_id,
            created_by_id=current_user.id,
            type=q_data.get("type", question_type),
            difficulty=q_data.get("difficulty", difficulty),
            title=q_data.get("title", ""),
            body=q_data.get("body", ""),
            explanation=q_data.get("explanation", ""),
            time_limit_seconds=q_data.get("time_limit_seconds", 300),
            max_score=q_data.get("max_score", 10),
        )
        db.add(question)
        await db.flush()

        # Add options
        for opt in q_data.get("options", []):
            db.add(QuestionOption(
                question_id=question.id,
                label=opt.get("label", ""),
                text=opt.get("text", ""),
                is_correct=opt.get("is_correct", False),
                order_index=opt.get("order_index", 0),
            ))

        # Add test cases
        for tc in q_data.get("test_cases", []):
            db.add(QuestionTestCase(
                question_id=question.id,
                input=tc.get("input", ""),
                expected_output=tc.get("expected_output", ""),
                is_hidden=tc.get("is_hidden", False),
                is_sample=tc.get("is_sample", True),
            ))

        # Add code stubs
        for cs in q_data.get("code_stubs", []):
            db.add(QuestionCodeStub(
                question_id=question.id,
                language=cs.get("language", "python"),
                stub_code=cs.get("stub_code", ""),
                solution_code=cs.get("solution_code", ""),
            ))

        # Add skill tags
        from app.models.taxonomy import Skill as TaxSkill
        for skill_name in q_data.get("skill_names", skills):
            skill_result = await db.execute(
                select(TaxSkill).where(TaxSkill.name == skill_name, TaxSkill.is_active == True)
            )
            skill = skill_result.scalar_one_or_none()
            if skill:
                db.add(QuestionTag(question_id=question.id, skill_id=skill.id))

        await db.flush()
        saved_questions.append({
            "id": str(question.id),
            "title": question.title,
            "type": question.type,
            "difficulty": question.difficulty,
        })

    return {
        "questions": saved_questions,
        "count": len(saved_questions),
        "saved_to_bank": True,
    }

