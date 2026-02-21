"""Question Generator Agent - generates assessment questions using AI."""

import logging
from typing import Any

from app.ai.providers.factory import get_ai_provider
from app.ai.prompts.question_prompts import (
    QUESTION_GENERATION_SYSTEM,
    QUESTION_GENERATION_PROMPT,
)

logger = logging.getLogger(__name__)


class QuestionGeneratorAgent:
    """Generates technical assessment questions using AI."""

    def __init__(self, provider_name: str | None = None):
        self.provider = get_ai_provider(provider_name)

    async def generate(
        self,
        skills: list[str],
        difficulty: str,
        question_type: str,
        count: int = 1,
    ) -> list[dict[str, Any]]:
        """Generate assessment questions.

        Args:
            skills: List of skill names to test.
            difficulty: Difficulty level (beginner/intermediate/advanced/expert).
            question_type: Type of question (mcq/multi_select/coding/etc).
            count: Number of questions to generate.

        Returns:
            List of generated question dicts.
        """
        prompt = QUESTION_GENERATION_PROMPT.format(
            count=count,
            skills=", ".join(skills),
            difficulty=difficulty,
            question_type=question_type,
        )

        result = await self.provider.complete_structured(
            prompt=prompt,
            system_prompt=QUESTION_GENERATION_SYSTEM,
            temperature=0.7,
            max_tokens=4000 * count,
        )

        questions = result.get("questions", [])

        # Validate and clean
        validated = []
        for q in questions:
            if not q.get("title") or not q.get("body"):
                continue

            # Ensure required fields
            q.setdefault("type", question_type)
            q.setdefault("difficulty", difficulty)
            q.setdefault("max_score", 10)
            q.setdefault("time_limit_seconds", 300)
            q.setdefault("options", [])
            q.setdefault("test_cases", [])
            q.setdefault("code_stubs", [])
            q.setdefault("skill_names", skills)

            validated.append(q)

        return validated
