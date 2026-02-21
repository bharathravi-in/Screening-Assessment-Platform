"""Auto-scoring service for candidate responses."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.candidate import CandidateSession
from app.models.question import Question, QuestionOption
from app.models.response import CandidateResponse


def auto_score_mcq(
    selected_option_ids: list[str] | None,
    correct_option_ids: list[str],
    max_score: float,
) -> float:
    """Score single-choice MCQ: full marks if correct, 0 otherwise."""
    if not selected_option_ids or len(selected_option_ids) != 1:
        return 0.0
    if selected_option_ids[0] in correct_option_ids:
        return max_score
    return 0.0


def auto_score_multi_select(
    selected_option_ids: list[str] | None,
    correct_option_ids: list[str],
    total_options: int,
    max_score: float,
) -> float:
    """Score multi-select with partial credit.

    Formula: (correct_selected - incorrect_selected) / total_correct * max_score
    Minimum score is 0 (no negative).
    """
    if not selected_option_ids:
        return 0.0

    correct_set = set(correct_option_ids)
    selected_set = set(selected_option_ids)

    correct_selected = len(selected_set & correct_set)
    incorrect_selected = len(selected_set - correct_set)

    if len(correct_set) == 0:
        return 0.0

    raw = (correct_selected - incorrect_selected) / len(correct_set)
    return max(0.0, round(raw * max_score, 2))


def auto_score_short_answer(
    text_response: str | None,
    expected_answers: list[str],
    max_score: float,
) -> float | None:
    """Score short answer with exact match (case-insensitive, trimmed).

    Returns None if no expected answers (needs AI grading).
    """
    if not expected_answers:
        return None

    if not text_response:
        return 0.0

    cleaned = text_response.strip().lower()
    for expected in expected_answers:
        if cleaned == expected.strip().lower():
            return max_score

    return 0.0


async def auto_score_response(
    response: CandidateResponse,
    question: Question,
    db: AsyncSession,
) -> float | None:
    """Auto-score a response based on question type. Returns score or None if needs manual/AI grading."""
    q_type = question.type.value if hasattr(question.type, "value") else question.type

    if q_type == "mcq":
        correct_ids = [
            str(opt.id) for opt in question.options if opt.is_correct
        ]
        return auto_score_mcq(
            response.selected_option_ids, correct_ids, question.max_score
        )

    elif q_type == "multi_select":
        correct_ids = [
            str(opt.id) for opt in question.options if opt.is_correct
        ]
        return auto_score_multi_select(
            response.selected_option_ids,
            correct_ids,
            len(question.options),
            question.max_score,
        )

    elif q_type == "short_answer":
        return auto_score_short_answer(
            response.text_response,
            [],  # No expected answers stored yet; needs AI grading
            question.max_score,
        )

    # coding, debugging, code_completion, system_design, scenario — need AI/sandbox
    return None


async def calculate_session_totals(
    session_id: UUID,
    db: AsyncSession,
) -> dict:
    """Calculate total scores for a session from all scored responses."""
    result = await db.execute(
        select(CandidateResponse).where(CandidateResponse.session_id == session_id)
    )
    responses = result.scalars().all()

    total_score = 0.0
    total_max = 0.0
    scored_count = 0

    for r in responses:
        if r.max_score is not None:
            total_max += r.max_score
        if r.final_score is not None:
            total_score += r.final_score
            scored_count += 1
        elif r.auto_score is not None:
            total_score += r.auto_score
            scored_count += 1

    score_pct = (total_score / total_max * 100) if total_max > 0 else None

    return {
        "total_score": round(total_score, 2),
        "total_max_score": round(total_max, 2),
        "score_pct": round(score_pct, 2) if score_pct is not None else None,
        "scored_count": scored_count,
        "total_count": len(responses),
    }
