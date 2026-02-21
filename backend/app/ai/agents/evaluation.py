"""Evaluation Agent - AI-powered evaluation of candidate responses."""

import logging
from typing import Any

from app.ai.providers.factory import get_ai_provider
from app.ai.prompts.evaluation_prompts import (
    EVALUATION_SYSTEM,
    EVALUATION_PROMPT,
    SESSION_SUMMARY_SYSTEM,
    SESSION_SUMMARY_PROMPT,
)

logger = logging.getLogger(__name__)


class EvaluationAgent:
    """Evaluates candidate responses and generates session summaries."""

    def __init__(self, provider_name: str | None = None):
        self.provider = get_ai_provider(provider_name)

    async def evaluate_response(
        self,
        question_type: str,
        question_title: str,
        question_body: str,
        response_text: str,
        max_score: float,
        code_execution_results: dict | None = None,
    ) -> dict[str, Any]:
        """Evaluate a single candidate response.

        Args:
            question_type: Type of question.
            question_title: Question title.
            question_body: Full question text.
            response_text: Candidate's response (text or code).
            max_score: Maximum score for this question.
            code_execution_results: Optional sandbox execution results.

        Returns:
            Evaluation result with score, feedback, strengths, weaknesses.
        """
        code_results_section = ""
        if code_execution_results:
            results = code_execution_results.get("results", [])
            passed = code_execution_results.get("passed", 0)
            total = code_execution_results.get("total", 0)
            code_results_section = f"Code Execution Results: {passed}/{total} test cases passed\n"
            for r in results:
                status = "PASS" if r.get("passed") else "FAIL"
                code_results_section += f"  [{status}] Input: {r.get('input', '')!r} -> Output: {r.get('actual_output', '')!r} (Expected: {r.get('expected_output', '')!r})\n"
                if r.get("error"):
                    code_results_section += f"    Error: {r['error']}\n"

        prompt = EVALUATION_PROMPT.format(
            question_type=question_type,
            question_title=question_title,
            question_body=question_body,
            max_score=max_score,
            response=response_text,
            code_results_section=code_results_section,
        )

        result = await self.provider.complete_structured(
            prompt=prompt,
            system_prompt=EVALUATION_SYSTEM,
            temperature=0.3,
            max_tokens=2000,
        )

        # Ensure score is within bounds
        score = result.get("score", 0)
        result["score"] = max(0, min(float(score), float(max_score)))
        result["max_score"] = float(max_score)

        return result

    async def evaluate_session(
        self,
        candidate_name: str,
        assessment_title: str,
        score_pct: float | None,
        question_results: list[dict],
    ) -> dict[str, Any]:
        """Generate an overall session summary.

        Args:
            candidate_name: Candidate's name.
            assessment_title: Assessment title.
            score_pct: Overall score percentage.
            question_results: List of per-question results.

        Returns:
            Session summary with recommendation.
        """
        results_str = "\n".join(
            f"- {r['title']} ({r['type']}, {r['difficulty']}): {r.get('score', 'N/A')}/{r.get('max_score', 'N/A')} - {r.get('feedback', 'No feedback')}"
            for r in question_results
        )

        prompt = SESSION_SUMMARY_PROMPT.format(
            candidate_name=candidate_name,
            assessment_title=assessment_title,
            score_pct=f"{score_pct:.1f}" if score_pct is not None else "N/A",
            question_results=results_str,
        )

        return await self.provider.complete_structured(
            prompt=prompt,
            system_prompt=SESSION_SUMMARY_SYSTEM,
            temperature=0.3,
            max_tokens=2000,
        )
