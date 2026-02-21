"""Assessment Builder Agent - auto-builds assessments from job descriptions."""

import logging
from typing import Any

from app.ai.providers.factory import get_ai_provider
from app.ai.prompts.assessment_prompts import (
    JD_ANALYSIS_SYSTEM,
    JD_ANALYSIS_PROMPT,
    ASSESSMENT_BLUEPRINT_SYSTEM,
    ASSESSMENT_BLUEPRINT_PROMPT,
)

logger = logging.getLogger(__name__)


class AssessmentBuilderAgent:
    """Builds assessment blueprints from job descriptions."""

    def __init__(self, provider_name: str | None = None):
        self.provider = get_ai_provider(provider_name)

    async def analyze_jd(self, job_description: str) -> dict[str, Any]:
        """Analyze a job description to extract requirements.

        Args:
            job_description: Full job description text.

        Returns:
            Structured job requirements.
        """
        prompt = JD_ANALYSIS_PROMPT.format(job_description=job_description)
        return await self.provider.complete_structured(
            prompt=prompt,
            system_prompt=JD_ANALYSIS_SYSTEM,
            temperature=0.3,
            max_tokens=2000,
        )

    async def build(
        self,
        job_description: str,
        available_skills: list[dict],
        question_count: int = 20,
        time_limit: int = 60,
        difficulty_mix: dict[str, int] | None = None,
    ) -> dict[str, Any]:
        """Build a complete assessment blueprint.

        Args:
            job_description: Job description text.
            available_skills: Skills available in the question bank.
            question_count: Target number of questions.
            time_limit: Time limit in minutes.
            difficulty_mix: Distribution e.g. {"beginner": 20, "intermediate": 40, "advanced": 30, "expert": 10}.

        Returns:
            Assessment blueprint dict.
        """
        if difficulty_mix is None:
            difficulty_mix = {
                "beginner": 20,
                "intermediate": 40,
                "advanced": 30,
                "expert": 10,
            }

        # Step 1: Analyze JD
        jd_analysis = await self.analyze_jd(job_description)

        # Step 2: Build blueprint
        skills_str = "\n".join(
            f"- {s['technology']}: {', '.join(s['skills'])}"
            for s in available_skills
        )

        prompt = ASSESSMENT_BLUEPRINT_PROMPT.format(
            job_requirements=str(jd_analysis),
            available_skills=skills_str,
            question_count=question_count,
            time_limit=time_limit,
            difficulty_mix=str(difficulty_mix),
        )

        blueprint = await self.provider.complete_structured(
            prompt=prompt,
            system_prompt=ASSESSMENT_BLUEPRINT_SYSTEM,
            temperature=0.4,
            max_tokens=4000,
        )

        blueprint["jd_analysis"] = jd_analysis
        return blueprint
