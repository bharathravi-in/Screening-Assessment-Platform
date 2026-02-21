"""Resume-based Question Generator Agent.

Generates personalized assessment questions based on resume content,
targeting claimed skills for validation and probing potential weak areas.
"""

import logging
from typing import Any

from app.ai.providers.factory import get_ai_provider

logger = logging.getLogger(__name__)

RESUME_QG_SYSTEM = """You are an expert technical interviewer AI. Given a candidate's resume,
you generate targeted assessment questions that:
1. Validate claimed technical skills and experience
2. Probe potential weak areas or knowledge gaps
3. Test real-world application of stated technologies
Always respond with valid JSON."""

RESUME_QG_PROMPT = """Based on this resume, generate {count} {question_type} questions at {difficulty} difficulty.

Resume Content:
{resume_text}

{skills_section}

Generate questions that specifically target the candidate's claimed skills and experience.
For each question, explain why it's relevant to their resume.

Return JSON:
{{
    "questions": [
        {{
            "type": "{question_type}",
            "difficulty": "{difficulty}",
            "title": "question title",
            "body": "full question text with context",
            "explanation": "why this question is relevant to the candidate's resume",
            "max_score": 10,
            "resume_relevance": "which part of the resume this targets",
            "skill_names": ["targeted skills"],
            "options": [
                {{"label": "A", "text": "option text", "is_correct": false, "order_index": 0}},
                ...
            ],
            "test_cases": [
                {{"input": "test input", "expected_output": "expected output", "is_hidden": false, "is_sample": true}},
                ...
            ],
            "code_stubs": [
                {{"language": "python", "stub_code": "def solution():\\n    pass", "solution_code": "def solution():\\n    return 42"}}
            ]
        }}
    ]
}}"""


class ResumeQuestionGeneratorAgent:
    """Generates personalized questions based on resume analysis."""

    def __init__(self, provider_name: str | None = None):
        self.provider = get_ai_provider(provider_name)

    async def generate(
        self,
        resume_text: str,
        skills: list[str] | None = None,
        difficulty: str = "intermediate",
        count: int = 5,
        question_type: str = "mcq",
    ) -> list[dict[str, Any]]:
        """Generate assessment questions based on resume content.

        Args:
            resume_text: Raw text from the resume.
            skills: Optional list of specific skills to target.
            difficulty: Target difficulty level.
            count: Number of questions to generate.
            question_type: Type of questions (mcq, coding, etc.)

        Returns:
            List of generated question dicts.
        """
        skills_section = ""
        if skills:
            skills_section = f"Focus specifically on these skills: {', '.join(skills)}"

        prompt = RESUME_QG_PROMPT.format(
            count=count,
            question_type=question_type,
            difficulty=difficulty,
            resume_text=resume_text[:5000],  # Limit resume length
            skills_section=skills_section,
        )

        result = await self.provider.complete_structured(
            prompt=prompt,
            system_prompt=RESUME_QG_SYSTEM,
            temperature=0.7,
            max_tokens=4000 * count,
        )

        questions = result.get("questions", [])

        # Validate
        validated = []
        for q in questions:
            if not q.get("title") or not q.get("body"):
                continue
            q.setdefault("type", question_type)
            q.setdefault("difficulty", difficulty)
            q.setdefault("max_score", 10)
            q.setdefault("options", [])
            q.setdefault("test_cases", [])
            q.setdefault("code_stubs", [])
            q.setdefault("skill_names", skills or [])
            validated.append(q)

        return validated
