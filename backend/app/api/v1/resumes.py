"""Resume management API router.

Handles resume upload, AI parsing, and skill matching.
"""

import os
import uuid

import aiofiles
import pdfplumber
from docx import Document as DocxDocument
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.permissions import get_current_user, is_super_admin, require_roles
from app.db.session import get_db
from app.models.resume import Resume
from app.models.taxonomy import Skill, Technology
from app.models.user import User
from app.schemas.resume import (
    ResumeDetailResponse,
    ResumeListResponse,
    ResumeUploadResponse,
)

router = APIRouter(prefix="/resumes", tags=["resumes"])


def _extract_text_from_pdf(file_path: str) -> str:
    """Extract text from a PDF file using pdfplumber."""
    text_parts = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    return "\n".join(text_parts)


def _extract_text_from_docx(file_path: str) -> str:
    """Extract text from a DOCX file."""
    doc = DocxDocument(file_path)
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


async def _get_taxonomy(db: AsyncSession) -> list[dict]:
    """Get taxonomy for skill matching."""
    result = await db.execute(
        select(Technology).where(Technology.is_active == True)
    )
    technologies = result.scalars().all()

    taxonomy = []
    for tech in technologies:
        skills_result = await db.execute(
            select(Skill).where(Skill.technology_id == tech.id, Skill.is_active == True)
        )
        skills = skills_result.scalars().all()
        taxonomy.append({
            "technology": tech.name,
            "skills": [s.name for s in skills],
        })
    return taxonomy


# ---------------------------------------------------------------------------
# POST /resumes/upload  — upload + parse a resume
# ---------------------------------------------------------------------------

@router.post("/upload", response_model=ResumeUploadResponse)
async def upload_resume(
    file: UploadFile = File(...),
    candidate_email: str = Form(...),
    candidate_name: str = Form(None),
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    """Upload a resume file and trigger AI parsing."""
    # Validate file type
    allowed_types = {"application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF and DOCX files are supported",
        )

    ext = "pdf" if "pdf" in (file.content_type or "") else "docx"

    # Save file
    upload_dir = os.path.join(settings.upload_dir, "resumes")
    os.makedirs(upload_dir, exist_ok=True)

    filename = f"{uuid.uuid4()}.{ext}"
    file_path = os.path.join(upload_dir, filename)

    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    # Create resume record
    resume = Resume(
        organization_id=current_user.organization_id,
        candidate_email=candidate_email,
        candidate_name=candidate_name,
        file_path=file_path,
        file_type=ext,
        file_size_bytes=len(content),
        status="uploaded",
    )
    db.add(resume)
    await db.flush()
    await db.refresh(resume)

    # Parse in background (synchronous for now)
    try:
        resume.status = "parsing"
        await db.flush()

        # Extract text
        if ext == "pdf":
            text = _extract_text_from_pdf(file_path)
        else:
            text = _extract_text_from_docx(file_path)

        if not text.strip():
            resume.status = "failed"
            resume.error_message = "Could not extract text from the file"
            await db.flush()
        else:
            # AI parse
            from app.ai.agents.resume_parser import ResumeParserAgent

            taxonomy = await _get_taxonomy(db)
            agent = ResumeParserAgent()
            parsed = await agent.parse_and_match(text, taxonomy)

            resume.parsed_data = parsed
            resume.matched_skills = {
                "matched": parsed.get("matched_skills", []),
                "unmatched": parsed.get("unmatched_skills", []),
            }
            resume.candidate_name = parsed.get("name") or candidate_name
            resume.status = "parsed"
            await db.flush()
    except Exception as e:
        resume.status = "failed"
        resume.error_message = str(e)
        await db.flush()

    await db.commit()

    return ResumeUploadResponse(
        id=str(resume.id),
        candidate_email=resume.candidate_email,
        candidate_name=resume.candidate_name,
        file_type=resume.file_type,
        status=resume.status,
        created_at=resume.created_at,
    )


# ---------------------------------------------------------------------------
# GET /resumes/  — list resumes
# ---------------------------------------------------------------------------

@router.get("/", response_model=ResumeListResponse)
async def list_resumes(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    """List all resumes in the organization."""
    query = select(Resume)
    if not is_super_admin(current_user):
        query = query.where(Resume.organization_id == current_user.organization_id)
    query = query.order_by(Resume.created_at.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    resumes = result.scalars().all()

    # Count total
    count_query = select(Resume)
    if not is_super_admin(current_user):
        count_query = count_query.where(Resume.organization_id == current_user.organization_id)
    count_result = await db.execute(count_query)
    total = len(count_result.scalars().all())

    return ResumeListResponse(
        resumes=[
            ResumeUploadResponse(
                id=str(r.id),
                candidate_email=r.candidate_email,
                candidate_name=r.candidate_name,
                file_type=r.file_type,
                status=r.status,
                created_at=r.created_at,
            )
            for r in resumes
        ],
        total=total,
    )


# ---------------------------------------------------------------------------
# GET /resumes/{resume_id}  — get resume details
# ---------------------------------------------------------------------------

@router.get("/{resume_id}", response_model=ResumeDetailResponse)
async def get_resume(
    resume_id: str,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    """Get resume details with parsed data and matched skills."""
    result = await db.execute(
        select(Resume).where(Resume.id == resume_id)
    )
    resume = result.scalar_one_or_none()

    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    return ResumeDetailResponse(
        id=str(resume.id),
        organization_id=str(resume.organization_id) if resume.organization_id else None,
        candidate_email=resume.candidate_email,
        candidate_name=resume.candidate_name,
        file_type=resume.file_type,
        status=resume.status,
        parsed_data=resume.parsed_data,
        matched_skills=resume.matched_skills,
        error_message=resume.error_message,
        created_at=resume.created_at,
    )


# ---------------------------------------------------------------------------
# GET /resumes/{resume_id}/skills  — get matched skills
# ---------------------------------------------------------------------------

@router.get("/{resume_id}/skills")
async def get_resume_skills(
    resume_id: str,
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    """Get matched skills from a parsed resume."""
    result = await db.execute(
        select(Resume).where(Resume.id == resume_id)
    )
    resume = result.scalar_one_or_none()

    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    return {
        "resume_id": str(resume.id),
        "candidate_email": resume.candidate_email,
        "matched_skills": resume.matched_skills or {},
        "all_skills": (resume.parsed_data or {}).get("skills", []),
    }


# ---------------------------------------------------------------------------
# POST /resumes/{resume_id}/create-assessment  — One-click AI pipeline
# ---------------------------------------------------------------------------

@router.post("/{resume_id}/create-assessment")
async def create_assessment_from_resume(
    request: Request,
    resume_id: str,
    body: dict = {},
    current_user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    """One-click pipeline: Resume → AI Questions → Assessment → Invite Link.

    Body (optional): {
        "title": "Custom title",
        "question_count": 10,
        "difficulty_mix": {"beginner": 2, "intermediate": 5, "advanced": 3},
        "time_limit_minutes": 60,
        "send_email": true
    }
    """
    import secrets
    from datetime import datetime, timezone


    from app.ai.agents.question_generator import QuestionGeneratorAgent
    from app.models.assessment import Assessment, AssessmentQuestion
    from app.models.question import Question, QuestionOption, QuestionTestCase, QuestionCodeStub, QuestionTag
    from app.models.candidate import CandidateInvitation

    # Load resume
    result = await db.execute(select(Resume).where(Resume.id == resume_id))
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    if resume.status != "parsed":
        raise HTTPException(status_code=400, detail="Resume must be parsed first")

    # Extract matched skills
    matched = resume.matched_skills or {}
    skill_names = matched.get("matched", [])
    parsed_data = resume.parsed_data or {}

    # Fallback to parsed skills if no matched taxonomy skills
    if not skill_names:
        skill_names = parsed_data.get("skills", [])

    if not skill_names:
        raise HTTPException(status_code=400, detail="No skills found in resume. Upload a more detailed resume.")

    # Limit to top skills
    skill_names = skill_names[:10]

    candidate_name = resume.candidate_name or resume.candidate_email.split("@")[0]
    question_count = min(body.get("question_count", 10), 20)
    time_limit = body.get("time_limit_minutes", 60)
    title = body.get("title", f"Assessment for {candidate_name}")

    # Step 1: AI-generate questions based on resume skills
    agent = QuestionGeneratorAgent()

    difficulty_mix = body.get("difficulty_mix", {
        "beginner": max(1, question_count // 4),
        "intermediate": max(1, question_count // 2),
        "advanced": max(1, question_count - question_count // 4 - question_count // 2),
    })

    all_questions = []
    for difficulty, count in difficulty_mix.items():
        if count <= 0:
            continue
        questions = await agent.generate(
            skills=skill_names,
            difficulty=difficulty,
            question_type="mcq",
            count=count,
        )
        all_questions.extend(questions)

    if not all_questions:
        raise HTTPException(status_code=500, detail="AI failed to generate questions")

    # Step 2: Create assessment
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="User must belong to an organization")

    assessment = Assessment(
        organization_id=current_user.organization_id,
        created_by_id=current_user.id,
        title=title,
        description=f"Auto-generated assessment based on {candidate_name}'s resume. Skills: {', '.join(skill_names[:5])}.",
        time_limit_minutes=time_limit,
        status="draft",
    )
    db.add(assessment)
    await db.flush()

    # Step 3: Save questions to question bank and link to assessment
    for idx, q_data in enumerate(all_questions):
        question = Question(
            organization_id=current_user.organization_id,
            created_by_id=current_user.id,
            type=q_data.get("type", "mcq"),
            difficulty=q_data.get("difficulty", "intermediate"),
            title=q_data.get("title", f"Question {idx + 1}"),
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

        # Link to assessment
        aq = AssessmentQuestion(
            assessment_id=assessment.id,
            question_id=question.id,
            order_index=idx,
            weight=1.0,
            is_required=True,
        )
        db.add(aq)

    await db.flush()

    # Step 4: Publish assessment
    assessment.status = "published"
    await db.flush()

    # Step 5: Create invitation
    token = secrets.token_urlsafe(48)
    invitation = CandidateInvitation(
        assessment_id=assessment.id,
        organization_id=current_user.organization_id,
        invited_by_id=current_user.id,
        candidate_email=resume.candidate_email,
        candidate_name=candidate_name,
        token=token,
        status="pending",
        sent_at=datetime.now(timezone.utc),
    )
    db.add(invitation)
    await db.flush()
    await db.refresh(invitation)

    # Build invite link
    origin = ""
    if request:
        origin = request.headers.get("origin", "")
        if not origin:
            origin = str(request.base_url).rstrip("/")
    invite_link = f"{origin}/test/verify/{token}"

    # Send email if requested
    if body.get("send_email", False):
        try:
            from app.services.email import send_invitation_email
            from app.models.organization import Organization

            org_name = ""
            if current_user.organization_id:
                org_result = await db.execute(
                    select(Organization).where(Organization.id == current_user.organization_id)
                )
                org = org_result.scalar_one_or_none()
                if org:
                    org_name = org.name

            await send_invitation_email(
                db=db,
                candidate_email=resume.candidate_email,
                candidate_name=candidate_name,
                assessment_title=title,
                invite_link=invite_link,
                organization_name=org_name,
            )
            invitation.status = "sent"
            await db.flush()
        except Exception:
            pass

    return {
        "assessment_id": str(assessment.id),
        "assessment_title": title,
        "questions_generated": len(all_questions),
        "skills_tested": skill_names,
        "invite_link": invite_link,
        "invitation_id": str(invitation.id),
        "candidate_email": resume.candidate_email,
        "candidate_name": candidate_name,
    }

