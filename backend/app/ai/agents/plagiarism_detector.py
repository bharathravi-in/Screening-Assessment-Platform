"""Plagiarism Detector Agent — analyzes code submissions for plagiarism indicators."""

import logging
from typing import Any

from app.ai.providers.factory import get_ai_provider
from app.ai.prompts.plagiarism_prompts import (
    PLAGIARISM_DETECTION_SYSTEM,
    PLAGIARISM_DETECTION_PROMPT,
)

logger = logging.getLogger(__name__)


class PlagiarismDetectorAgent:
    """Analyzes code submissions for plagiarism and copied solutions."""

    def __init__(self, provider_name: str | None = None):
        self.provider = get_ai_provider(provider_name)

    async def analyze(
        self,
        question_title: str,
        language: str,
        difficulty: str,
        code: str,
        time_spent_seconds: int = 0,
        typing_anomalies: str = "none",
        paste_events: int = 0,
        snapshot_count: int = 0,
    ) -> dict[str, Any]:
        """Analyze a code submission for plagiarism.

        Returns:
            Dict with plagiarism_score, confidence, indicators, flagged_segments, summary.
        """
        prompt = PLAGIARISM_DETECTION_PROMPT.format(
            question_title=question_title,
            language=language,
            difficulty=difficulty,
            code=code[:3000],  # Limit code length
            time_spent_seconds=time_spent_seconds,
            typing_anomalies=typing_anomalies,
            paste_events=paste_events,
            snapshot_count=snapshot_count,
        )

        try:
            result = await self.provider.complete_structured(
                prompt=prompt,
                system_prompt=PLAGIARISM_DETECTION_SYSTEM,
                temperature=0.2,
                max_tokens=2000,
            )
        except Exception as e:
            logger.error("Plagiarism detection failed: %s", e)
            return {
                "plagiarism_score": 0,
                "confidence": 0,
                "indicators": [],
                "flagged_segments": [],
                "summary": "Analysis unavailable",
            }

        # Bound scores
        result["plagiarism_score"] = max(0, min(float(result.get("plagiarism_score", 0)), 100))
        result["confidence"] = max(0, min(float(result.get("confidence", 0)), 100))

        return result
