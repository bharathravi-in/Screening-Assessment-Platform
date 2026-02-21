"""Resume Parser Agent - extracts structured data from resumes and matches skills to taxonomy."""

import logging
from typing import Any

from app.ai.providers.factory import get_ai_provider
from app.ai.prompts.resume_prompts import (
    RESUME_EXTRACTION_SYSTEM,
    RESUME_EXTRACTION_PROMPT,
    SKILL_MATCHING_SYSTEM,
    SKILL_MATCHING_PROMPT,
)

logger = logging.getLogger(__name__)


class ResumeParserAgent:
    """Parses resumes and matches extracted skills to the platform taxonomy."""

    def __init__(self, provider_name: str | None = None):
        self.provider = get_ai_provider(provider_name)

    async def parse(self, resume_text: str) -> dict[str, Any]:
        """Extract structured data from resume text.

        Args:
            resume_text: Raw text extracted from resume file.

        Returns:
            Parsed resume data as a dict.
        """
        prompt = RESUME_EXTRACTION_PROMPT.format(resume_text=resume_text)
        result = await self.provider.complete_structured(
            prompt=prompt,
            system_prompt=RESUME_EXTRACTION_SYSTEM,
            temperature=0.2,
            max_tokens=3000,
        )
        return result

    async def match_skills(
        self,
        extracted_skills: list[str],
        taxonomy: list[dict],
    ) -> dict[str, Any]:
        """Match extracted skills against platform taxonomy.

        Args:
            extracted_skills: Skills extracted from resume.
            taxonomy: List of {technology, skills} from the platform.

        Returns:
            Dict with matched_skills and unmatched_skills.
        """
        taxonomy_str = "\n".join(
            f"- {t['technology']}: {', '.join(t['skills'])}"
            for t in taxonomy
        )
        prompt = SKILL_MATCHING_PROMPT.format(
            extracted_skills=", ".join(extracted_skills),
            taxonomy=taxonomy_str,
        )
        result = await self.provider.complete_structured(
            prompt=prompt,
            system_prompt=SKILL_MATCHING_SYSTEM,
            temperature=0.2,
            max_tokens=2000,
        )
        return result

    async def parse_and_match(
        self,
        resume_text: str,
        taxonomy: list[dict],
    ) -> dict[str, Any]:
        """Parse resume and match skills in one call.

        Args:
            resume_text: Raw text from resume.
            taxonomy: Platform taxonomy.

        Returns:
            Combined parsed data with matched skills.
        """
        parsed = await self.parse(resume_text)
        extracted_skills = parsed.get("skills", [])

        if extracted_skills and taxonomy:
            matching = await self.match_skills(extracted_skills, taxonomy)
            parsed["matched_skills"] = matching.get("matched_skills", [])
            parsed["unmatched_skills"] = matching.get("unmatched_skills", [])
        else:
            parsed["matched_skills"] = []
            parsed["unmatched_skills"] = extracted_skills

        return parsed
