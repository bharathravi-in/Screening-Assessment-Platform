"""AI-Driven Candidate Insights API endpoints.

Provides AI-powered candidate analysis including:
- Skill gap analysis
- Hiring recommendations
- Comparative candidate ranking
- Resume-based question generation
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.permissions import require_roles
from app.db.session import get_db
from app.models.assessment import Assessment, AssessmentQuestion
from app.models.candidate import CandidateSession
from app.models.question import Question
from app.models.response import CandidateResponse
from app.models.user import User
from app.ai.agents.candidate_insights import CandidateInsightsAgent
from app.ai.agents.resume_question_generator import ResumeQuestionGeneratorAgent

router = APIRouter(tags=["insights"])


# ---------------------------------------------------------------------------
# Request/Response schemas
# ---------------------------------------------------------------------------

class ResumeQuestionRequest(BaseModel):
    resume_text: str
    skills: list[str] | None = None
    difficulty: str = "intermediate"
    count: int = 5
    question_type: str = "mcq"


# ---------------------------------------------------------------------------
# GET /insights/candidate/{session_id}
# ---------------------------------------------------------------------------

@router.get("/candidate/{session_id}")
async def get_candidate_insights(
    session_id: UUID,
    user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    """Get comprehensive AI-powered candidate analysis for a session.

    Includes skill gap analysis, strengths/weaknesses, and hiring recommendation.
    """
    session = await db.get(CandidateSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Load assessment
    assessment = await db.get(Assessment, session.assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Load all responses with questions
    result = await db.execute(
        select(CandidateResponse)
        .where(CandidateResponse.session_id == session_id)
        .options(selectinload(CandidateResponse.question))
    )
    responses = result.scalars().all()

    # Build question results for the AI agent
    question_results = []
    for resp in responses:
        q = resp.question
        if not q:
            continue
        q_type = q.type.value if hasattr(q.type, "value") else q.type
        q_diff = q.difficulty.value if hasattr(q.difficulty, "value") else q.difficulty
        question_results.append({
            "title": q.title,
            "type": q_type,
            "difficulty": q_diff,
            "score": resp.final_score or resp.auto_score or resp.ai_score,
            "max_score": resp.max_score or q.max_score,
            "feedback": resp.evaluation_feedback or "",
            "time_spent_seconds": resp.time_spent_seconds,
            "code_response": resp.code_response[:500] if resp.code_response else None,
            "text_response": resp.text_response[:500] if resp.text_response else None,
        })

    agent = CandidateInsightsAgent()

    # Generate insights
    insights = await agent.generate_comprehensive_insights(
        candidate_name=session.candidate_name,
        assessment_title=assessment.title,
        score_pct=session.score_pct,
        question_results=question_results,
    )

    return {
        "session_id": str(session_id),
        "candidate_name": session.candidate_name,
        "assessment_title": assessment.title,
        "score_pct": session.score_pct,
        "insights": insights,
    }


# ---------------------------------------------------------------------------
# GET /insights/ranking/{assessment_id}
# ---------------------------------------------------------------------------

@router.get("/ranking/{assessment_id}")
async def get_candidate_ranking(
    assessment_id: UUID,
    user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    """Get ranked list of candidates for an assessment with AI comparative analysis."""
    assessment = await db.get(Assessment, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Load all completed sessions
    result = await db.execute(
        select(CandidateSession)
        .where(
            CandidateSession.assessment_id == assessment_id,
            CandidateSession.status.in_(["completed", "terminated", "timed_out"]),
        )
        .order_by(CandidateSession.score_pct.desc().nulls_last())
    )
    sessions = result.scalars().all()

    if not sessions:
        return {"assessment_id": str(assessment_id), "rankings": [], "total": 0}

    rankings = []
    for rank, session in enumerate(sessions, 1):
        # Calculate time taken
        time_taken = None
        if session.started_at and session.completed_at:
            time_taken = int((session.completed_at - session.started_at).total_seconds())

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
            "time_taken_seconds": time_taken,
            "proctoring_violations": session.proctoring_violations,
            "skill_scores": session.skill_scores,
            "started_at": session.started_at.isoformat() if session.started_at else None,
            "completed_at": session.completed_at.isoformat() if session.completed_at else None,
        })

    return {
        "assessment_id": str(assessment_id),
        "assessment_title": assessment.title,
        "rankings": rankings,
        "total": len(rankings),
    }


# ---------------------------------------------------------------------------
# GET /insights/skill-gap/{session_id}
# ---------------------------------------------------------------------------

@router.get("/skill-gap/{session_id}")
async def get_skill_gap_analysis(
    session_id: UUID,
    user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed skill gap analysis for a candidate session."""
    session = await db.get(CandidateSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Load responses with questions and their tags/skills
    result = await db.execute(
        select(CandidateResponse)
        .where(CandidateResponse.session_id == session_id)
        .options(
            selectinload(CandidateResponse.question)
            .selectinload(Question.tags)
        )
    )
    responses = result.scalars().all()

    # Build skill-level performance
    skill_performance: dict[str, dict] = {}
    for resp in responses:
        q = resp.question
        if not q:
            continue
        score = resp.final_score or resp.auto_score or 0
        max_score = resp.max_score or q.max_score or 10

        # Use question tags for skill mapping, or fallback to question type
        skill_keys = []
        if q.tags:
            for tag in q.tags:
                if hasattr(tag, "skill") and tag.skill:
                    skill_keys.append(tag.skill.name if hasattr(tag.skill, "name") else str(tag.skill_id))
        if not skill_keys:
            q_type = q.type.value if hasattr(q.type, "value") else q.type
            skill_keys = [q_type]

        for skill in skill_keys:
            if skill not in skill_performance:
                skill_performance[skill] = {
                    "skill": skill,
                    "questions_attempted": 0,
                    "total_score": 0,
                    "total_max": 0,
                    "score_pct": 0,
                }
            skill_performance[skill]["questions_attempted"] += 1
            skill_performance[skill]["total_score"] += score
            skill_performance[skill]["total_max"] += max_score

    # Calculate percentages
    skills = []
    for s in skill_performance.values():
        s["score_pct"] = round(s["total_score"] / s["total_max"] * 100, 1) if s["total_max"] > 0 else 0
        s["level"] = (
            "strong" if s["score_pct"] >= 80
            else "moderate" if s["score_pct"] >= 50
            else "needs_improvement"
        )
        skills.append(s)

    skills.sort(key=lambda x: x["score_pct"], reverse=True)

    return {
        "session_id": str(session_id),
        "candidate_name": session.candidate_name,
        "overall_score_pct": session.score_pct,
        "skills": skills,
        "strengths": [s for s in skills if s["level"] == "strong"],
        "gaps": [s for s in skills if s["level"] == "needs_improvement"],
    }


# ---------------------------------------------------------------------------
# POST /insights/resume-questions
# ---------------------------------------------------------------------------

@router.post("/resume-questions")
async def generate_resume_based_questions(
    body: ResumeQuestionRequest,
    user: User = Depends(require_roles("admin", "hr", "tech")),
    db: AsyncSession = Depends(get_db),
):
    """Generate personalized assessment questions based on resume content.

    Analyzes the resume to identify skills and generates targeted questions
    that validate claimed expertise or probe potential weak areas.
    """
    agent = ResumeQuestionGeneratorAgent()
    questions = await agent.generate(
        resume_text=body.resume_text,
        skills=body.skills,
        difficulty=body.difficulty,
        count=body.count,
        question_type=body.question_type,
    )

    return {
        "questions": questions,
        "count": len(questions),
    }
