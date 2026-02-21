"""Proctoring Analyzer Agent - analyzes test sessions for integrity violations."""

import json
import logging
from typing import Any

from app.ai.providers.factory import get_ai_provider
from app.ai.prompts.proctoring_prompts import (
    PROCTORING_ANALYSIS_SYSTEM,
    PROCTORING_ANALYSIS_PROMPT,
)

logger = logging.getLogger(__name__)


class ProctoringAnalyzerAgent:
    """Analyzes test sessions for proctoring integrity."""

    def __init__(self, provider_name: str | None = None):
        self.provider = get_ai_provider(provider_name)

    async def analyze_session(
        self,
        duration_minutes: float,
        total_violations: int,
        max_violations: int,
        violation_log: list[dict],
        response_timing: list[dict],
        code_responses: list[dict] | None = None,
    ) -> dict[str, Any]:
        """Analyze a test session for integrity violations.

        Args:
            duration_minutes: How long the session lasted.
            total_violations: Total violation count.
            max_violations: Max allowed violations.
            violation_log: List of violation events with type, details, timestamp.
            response_timing: List of {question_title, time_spent_seconds} dicts.
            code_responses: Optional list of {question_title, language, code} for style analysis.

        Returns:
            Analysis result with risk_level, findings, and recommendation.
        """
        violation_log_str = json.dumps(violation_log, indent=2) if violation_log else "No violations recorded"

        timing_str = "\n".join(
            f"- {t['question_title']}: {t['time_spent_seconds']}s"
            for t in response_timing
        ) if response_timing else "No timing data"

        code_str = ""
        if code_responses:
            for cr in code_responses[:5]:  # Limit to 5 code responses
                code_str += f"\n--- {cr['question_title']} ({cr['language']}) ---\n{cr['code'][:500]}\n"
        code_str = code_str or "No code responses"

        prompt = PROCTORING_ANALYSIS_PROMPT.format(
            duration_minutes=f"{duration_minutes:.1f}",
            total_violations=total_violations,
            max_violations=max_violations,
            violation_log=violation_log_str,
            response_timing=timing_str,
            code_responses=code_str,
        )

        result = await self.provider.complete_structured(
            prompt=prompt,
            system_prompt=PROCTORING_ANALYSIS_SYSTEM,
            temperature=0.2,
            max_tokens=3000,
        )

        # Ensure risk_score is bounded
        risk_score = result.get("risk_score", 0)
        result["risk_score"] = max(0, min(float(risk_score), 100))

        return result
