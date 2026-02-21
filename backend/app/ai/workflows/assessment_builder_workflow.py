"""LangGraph workflow for auto-building assessments from job descriptions.

Orchestrates: analyze JD -> match taxonomy skills -> select from bank + generate missing -> organize into sections
"""

import logging
from typing import Any, TypedDict

from langgraph.graph import StateGraph, END

logger = logging.getLogger(__name__)


class AssessmentBuilderState(TypedDict):
    """State for the assessment builder workflow."""
    job_description: str
    available_skills: list[dict]
    existing_questions: list[dict]
    question_count: int
    time_limit: int
    difficulty_mix: dict[str, int]
    # Outputs
    jd_analysis: dict
    blueprint: dict
    generated_questions: list[dict]
    final_assessment: dict


async def analyze_jd_node(state: AssessmentBuilderState) -> dict:
    """Analyze the job description."""
    from app.ai.agents.assessment_builder import AssessmentBuilderAgent

    agent = AssessmentBuilderAgent()
    analysis = await agent.analyze_jd(state["job_description"])
    return {"jd_analysis": analysis}


async def build_blueprint_node(state: AssessmentBuilderState) -> dict:
    """Build assessment blueprint based on JD analysis."""
    from app.ai.agents.assessment_builder import AssessmentBuilderAgent

    agent = AssessmentBuilderAgent()
    blueprint = await agent.build(
        job_description=state["job_description"],
        available_skills=state["available_skills"],
        question_count=state["question_count"],
        time_limit=state["time_limit"],
        difficulty_mix=state["difficulty_mix"],
    )
    return {"blueprint": blueprint}


async def generate_missing_node(state: AssessmentBuilderState) -> dict:
    """Generate questions for skills not covered by the existing bank."""
    from app.ai.agents.question_generator import QuestionGeneratorAgent

    agent = QuestionGeneratorAgent()
    generated = []

    blueprint = state.get("blueprint", {})
    sections = blueprint.get("sections", [])

    for section in sections:
        for q_spec in section.get("questions", []):
            if q_spec.get("from_bank") and q_spec.get("bank_question_id"):
                continue  # Use existing question

            skill = q_spec.get("skill_name", "General")
            q_type = q_spec.get("question_type", "mcq")
            difficulty = q_spec.get("difficulty", "intermediate")

            try:
                questions = await agent.generate(
                    skills=[skill],
                    difficulty=difficulty,
                    question_type=q_type,
                    count=1,
                )
                generated.extend(questions)
            except Exception as e:
                logger.warning("Question generation failed for %s: %s", skill, e)

    return {"generated_questions": generated}


async def finalize_assessment_node(state: AssessmentBuilderState) -> dict:
    """Compile the final assessment structure."""
    blueprint = state.get("blueprint", {})

    final = {
        "title": blueprint.get("title", "Auto-Generated Assessment"),
        "description": blueprint.get("description", ""),
        "instructions": blueprint.get("instructions", ""),
        "time_limit_minutes": state["time_limit"],
        "passing_score_pct": blueprint.get("passing_score_pct", 60),
        "sections": blueprint.get("sections", []),
        "jd_analysis": state.get("jd_analysis", {}),
        "generated_questions": state.get("generated_questions", []),
        "difficulty_distribution": blueprint.get("difficulty_distribution", {}),
    }

    return {"final_assessment": final}


def build_assessment_builder_workflow() -> StateGraph:
    """Build the assessment builder LangGraph workflow."""
    workflow = StateGraph(AssessmentBuilderState)

    workflow.add_node("analyze_jd", analyze_jd_node)
    workflow.add_node("build_blueprint", build_blueprint_node)
    workflow.add_node("generate_missing", generate_missing_node)
    workflow.add_node("finalize", finalize_assessment_node)

    workflow.set_entry_point("analyze_jd")
    workflow.add_edge("analyze_jd", "build_blueprint")
    workflow.add_edge("build_blueprint", "generate_missing")
    workflow.add_edge("generate_missing", "finalize")
    workflow.add_edge("finalize", END)

    return workflow
