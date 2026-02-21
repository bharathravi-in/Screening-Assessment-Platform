"""Taxonomy Generator Agent - generates technology taxonomies using AI."""

import logging
from typing import Any

from app.ai.providers.factory import get_ai_provider
from app.ai.prompts.taxonomy_prompts import (
    TAXONOMY_GENERATION_SYSTEM,
    TAXONOMY_GENERATION_PROMPT,
    TAXONOMY_FROM_JD_SYSTEM,
    TAXONOMY_FROM_JD_PROMPT,
)

logger = logging.getLogger(__name__)


class TaxonomyGeneratorAgent:
    """Generates technology taxonomies using AI."""

    def __init__(self, provider_name: str | None = None):
        self.provider = get_ai_provider(provider_name)

    async def generate_from_topic(
        self,
        topic: str,
        context: str = "",
        count: int = 5,
    ) -> list[dict[str, Any]]:
        """Generate taxonomy from a topic/domain.

        Args:
            topic: Domain or topic (e.g., "Full-Stack Web Development").
            context: Additional context or requirements.
            count: Number of technologies to generate.

        Returns:
            List of technology dicts with skills.
        """
        prompt = TAXONOMY_GENERATION_PROMPT.format(
            topic=topic,
            context=context or "General technical assessment",
            count=count,
        )

        result = await self.provider.complete_structured(
            prompt=prompt,
            system_prompt=TAXONOMY_GENERATION_SYSTEM,
            temperature=0.7,
            max_tokens=4000,
        )

        technologies = result.get("technologies", [])

        # Validate
        validated = []
        for tech in technologies:
            if not tech.get("name"):
                continue
            tech.setdefault("category", "other")
            tech.setdefault("description", "")
            skills = tech.get("skills", [])
            valid_skills = [s for s in skills if s.get("name")]
            tech["skills"] = valid_skills
            validated.append(tech)

        return validated

    async def generate_from_jd(
        self,
        job_description: str,
    ) -> dict[str, Any]:
        """Extract taxonomy from a job description.

        Args:
            job_description: Full job description text.

        Returns:
            Dict with technologies, role_title, seniority_level.
        """
        prompt = TAXONOMY_FROM_JD_PROMPT.format(
            job_description=job_description,
        )

        result = await self.provider.complete_structured(
            prompt=prompt,
            system_prompt=TAXONOMY_FROM_JD_SYSTEM,
            temperature=0.5,
            max_tokens=4000,
        )

        technologies = result.get("technologies", [])
        validated = []
        for tech in technologies:
            if not tech.get("name"):
                continue
            tech.setdefault("category", "other")
            tech.setdefault("description", "")
            skills = tech.get("skills", [])
            valid_skills = [s for s in skills if s.get("name")]
            tech["skills"] = valid_skills
            validated.append(tech)

        return {
            "technologies": validated,
            "role_title": result.get("role_title", ""),
            "seniority_level": result.get("seniority_level", "mid"),
        }
