"""LangGraph workflow for evaluating a completed test session.

Orchestrates: auto-score MCQ -> sandbox execute coding -> AI evaluate subjective -> proctoring analyze -> compile report
"""

import logging
from typing import Any, TypedDict

from langgraph.graph import StateGraph, END

logger = logging.getLogger(__name__)


class EvaluationState(TypedDict):
    """State for the evaluation workflow."""
    session_id: str
    candidate_name: str
    assessment_title: str
    responses: list[dict]
    questions: list[dict]
    proctoring_log: list[dict]
    proctoring_violations: int
    max_violations: int
    duration_minutes: float
    # Outputs
    auto_scores: dict[str, float]
    ai_evaluations: dict[str, dict]
    proctoring_report: dict
    session_summary: dict
    total_score: float
    total_max_score: float
    score_pct: float | None


async def auto_score_node(state: EvaluationState) -> dict:
    """Auto-score MCQ and multi-select questions."""
    from app.services.scoring import auto_score_mcq, auto_score_multi_select

    auto_scores = {}
    for resp in state["responses"]:
        q = next((q for q in state["questions"] if q["id"] == resp["question_id"]), None)
        if not q:
            continue

        q_type = q.get("type", "")
        if q_type == "mcq":
            correct_ids = [o["id"] for o in q.get("options", []) if o.get("is_correct")]
            score = auto_score_mcq(resp.get("selected_option_ids"), correct_ids, q.get("max_score", 10))
            auto_scores[resp["question_id"]] = score
        elif q_type == "multi_select":
            correct_ids = [o["id"] for o in q.get("options", []) if o.get("is_correct")]
            score = auto_score_multi_select(
                resp.get("selected_option_ids"), correct_ids,
                len(q.get("options", [])), q.get("max_score", 10),
            )
            auto_scores[resp["question_id"]] = score

    return {"auto_scores": auto_scores}


async def ai_evaluate_node(state: EvaluationState) -> dict:
    """AI-evaluate subjective responses (coding, system design, scenario)."""
    from app.ai.agents.evaluation import EvaluationAgent

    agent = EvaluationAgent()
    ai_evaluations = {}

    for resp in state["responses"]:
        q = next((q for q in state["questions"] if q["id"] == resp["question_id"]), None)
        if not q:
            continue

        q_type = q.get("type", "")
        if q_type in ("mcq", "multi_select"):
            continue  # Already auto-scored

        response_text = resp.get("code_response") or resp.get("text_response") or ""
        if not response_text:
            continue

        try:
            evaluation = await agent.evaluate_response(
                question_type=q_type,
                question_title=q.get("title", ""),
                question_body=q.get("body", ""),
                response_text=response_text,
                max_score=q.get("max_score", 10),
                code_execution_results=resp.get("code_execution_results"),
            )
            ai_evaluations[resp["question_id"]] = evaluation
        except Exception as e:
            logger.warning("AI evaluation failed for question %s: %s", resp["question_id"], e)

    return {"ai_evaluations": ai_evaluations}


async def proctoring_analyze_node(state: EvaluationState) -> dict:
    """Analyze proctoring data."""
    from app.ai.agents.proctoring import ProctoringAnalyzerAgent

    agent = ProctoringAnalyzerAgent()

    response_timing = []
    code_responses = []
    for resp in state["responses"]:
        q = next((q for q in state["questions"] if q["id"] == resp["question_id"]), None)
        if q:
            response_timing.append({
                "question_title": q.get("title", ""),
                "time_spent_seconds": resp.get("time_spent_seconds", 0),
            })
            if resp.get("code_response"):
                code_responses.append({
                    "question_title": q.get("title", ""),
                    "language": resp.get("code_language", "unknown"),
                    "code": resp["code_response"],
                })

    try:
        report = await agent.analyze_session(
            duration_minutes=state["duration_minutes"],
            total_violations=state["proctoring_violations"],
            max_violations=state["max_violations"],
            violation_log=state["proctoring_log"],
            response_timing=response_timing,
            code_responses=code_responses,
        )
    except Exception as e:
        logger.warning("Proctoring analysis failed: %s", e)
        report = {"risk_level": "unknown", "risk_score": 0, "recommendation": "review", "summary": "Analysis unavailable"}

    return {"proctoring_report": report}


async def compile_report_node(state: EvaluationState) -> dict:
    """Compile final evaluation report."""
    from app.ai.agents.evaluation import EvaluationAgent

    total_score = 0.0
    total_max = 0.0
    question_results = []

    for resp in state["responses"]:
        q = next((q for q in state["questions"] if q["id"] == resp["question_id"]), None)
        if not q:
            continue

        max_score = q.get("max_score", 10)
        total_max += max_score

        # Get score from auto or AI
        score = state["auto_scores"].get(resp["question_id"])
        feedback = "Auto-scored"
        if score is None:
            ai_eval = state["ai_evaluations"].get(resp["question_id"], {})
            score = ai_eval.get("score")
            feedback = ai_eval.get("feedback", "Not evaluated")

        if score is not None:
            total_score += score

        question_results.append({
            "title": q.get("title", ""),
            "type": q.get("type", ""),
            "difficulty": q.get("difficulty", ""),
            "score": score,
            "max_score": max_score,
            "feedback": feedback,
        })

    score_pct = (total_score / total_max * 100) if total_max > 0 else None

    # Generate session summary
    try:
        agent = EvaluationAgent()
        summary = await agent.evaluate_session(
            candidate_name=state["candidate_name"],
            assessment_title=state["assessment_title"],
            score_pct=score_pct,
            question_results=question_results,
        )
    except Exception as e:
        logger.warning("Session summary generation failed: %s", e)
        summary = {"overall_assessment": "Summary unavailable", "recommendation": "review"}

    return {
        "session_summary": summary,
        "total_score": round(total_score, 2),
        "total_max_score": round(total_max, 2),
        "score_pct": round(score_pct, 2) if score_pct is not None else None,
    }


def build_evaluation_workflow() -> StateGraph:
    """Build the evaluation LangGraph workflow."""
    workflow = StateGraph(EvaluationState)

    workflow.add_node("auto_score", auto_score_node)
    workflow.add_node("ai_evaluate", ai_evaluate_node)
    workflow.add_node("proctoring_analyze", proctoring_analyze_node)
    workflow.add_node("compile_report", compile_report_node)

    workflow.set_entry_point("auto_score")
    workflow.add_edge("auto_score", "ai_evaluate")
    workflow.add_edge("ai_evaluate", "proctoring_analyze")
    workflow.add_edge("proctoring_analyze", "compile_report")
    workflow.add_edge("compile_report", END)

    return workflow
